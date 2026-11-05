#!/usr/bin/env bash
# Corre `pnpm test:integration` contra contenedores DESECHABLES: Postgres de
# Supabase (con sus roles) y PostgREST. Nada de esto toca una base real: las
# contraseñas y el secreto JWT se generan al vuelo y mueren con los contenedores.
#
# Requiere: docker, psql, openssl, curl, pnpm. Uso: scripts/test-integracion.sh [args de vitest]
set -euo pipefail
cd "$(dirname "$0")/.."

PG_IMAGE="${PG_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.167}"
REST_IMAGE="${REST_IMAGE:-public.ecr.aws/supabase/postgrest:v16.2}"
PG_PORT="${PG_PORT:-55433}"
REST_PORT="${REST_PORT:-53000}"
ESPERA_MAXIMA_S="${ESPERA_MAXIMA_S:-60}"

SUFIJO="$$"
RED="ladder-lab-itest-${SUFIJO}"
PG="ladder-lab-itest-pg-${SUFIJO}"
REST="ladder-lab-itest-rest-${SUFIJO}"
CLAVE_PG="$(openssl rand -hex 12)"
SECRETO_JWT="$(openssl rand -hex 24)"
BASE_REST="itest_rest"

limpiar() {
  docker rm -f "$PG" "$REST" >/dev/null 2>&1 || true
  docker network rm "$RED" >/dev/null 2>&1 || true
}
trap limpiar EXIT

esperar() { # esperar <descripcion> <comando...>
  local descripcion="$1"; shift
  for _ in $(seq 1 "$ESPERA_MAXIMA_S"); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "TIMEOUT esperando: ${descripcion}" >&2
  return 1
}

URL_ADMIN="postgresql://postgres:${CLAVE_PG}@127.0.0.1:${PG_PORT}/postgres"
URL_REST_DB="postgresql://postgres:${CLAVE_PG}@127.0.0.1:${PG_PORT}/${BASE_REST}"

echo "▶ Postgres de Supabase en 127.0.0.1:${PG_PORT} (desechable)"
docker network create "$RED" >/dev/null
docker run -d --name "$PG" --network "$RED" --network-alias pg \
  -p "127.0.0.1:${PG_PORT}:5432" -e POSTGRES_PASSWORD="$CLAVE_PG" "$PG_IMAGE" >/dev/null
esperar "Postgres" psql "$URL_ADMIN" -tAc "select 1"
# La imagen reserva el rol authenticator: solo un superusuario puede darle clave.
esperar "rol authenticator" docker exec "$PG" psql -U supabase_admin -d postgres -tAc \
  "alter role authenticator with password '${CLAVE_PG}'"

echo "▶ Migraciones en la base ${BASE_REST}"
psql "$URL_ADMIN" -X -q -v ON_ERROR_STOP=1 -c "create database ${BASE_REST}"
for migracion in supabase/migrations/*.sql; do
  psql "$URL_REST_DB" -X -q -v ON_ERROR_STOP=1 -f "$migracion"
done

echo "▶ PostgREST en 127.0.0.1:${REST_PORT}"
docker run -d --name "$REST" --network "$RED" -p "127.0.0.1:${REST_PORT}:3000" \
  -e PGRST_DB_URI="postgres://authenticator:${CLAVE_PG}@pg:5432/${BASE_REST}" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="$SECRETO_JWT" -e PGRST_DB_MAX_ROWS=1000 "$REST_IMAGE" >/dev/null
esperar "PostgREST" curl -s -o /dev/null "http://127.0.0.1:${REST_PORT}/"

echo "▶ pnpm test:integration"
TEST_DATABASE_URL="$URL_ADMIN" \
TEST_REST_URL="http://127.0.0.1:${REST_PORT}" \
TEST_REST_JWT_SECRET="$SECRETO_JWT" \
TEST_REST_DB_URL="$URL_REST_DB" \
  pnpm test:integration "$@"
