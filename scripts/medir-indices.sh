#!/usr/bin/env bash
# Mide las consultas de las herramientas con EXPLAIN ANALYZE sobre datos SINTÉTICOS
# en un Postgres de Supabase desechable. No toca ninguna base real.
# Para medir con datos reales: apuntar MEDIR_URL a una copia (nunca a producción).
#
# Uso: scripts/medir-indices.sh [N estampas (20000)]
set -euo pipefail
cd "$(dirname "$0")/.."

ESTAMPAS="${1:-20000}"
PG_IMAGE="${PG_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.167}"
PG_PORT="${PG_PORT:-55434}"
NOMBRE="ladder-lab-medir-$$"
CLAVE="$(openssl rand -hex 12)"
JUEGOS=40

limpiar() { docker rm -f "$NOMBRE" >/dev/null 2>&1 || true; }
trap limpiar EXIT

if [ -z "${MEDIR_URL:-}" ]; then
  docker run -d --name "$NOMBRE" -p "127.0.0.1:${PG_PORT}:5432" -e POSTGRES_PASSWORD="$CLAVE" "$PG_IMAGE" >/dev/null
  URL="postgresql://postgres:${CLAVE}@127.0.0.1:${PG_PORT}/postgres"
  for _ in $(seq 1 60); do psql "$URL" -tAc "select 1" >/dev/null 2>&1 && break; sleep 1; done
  psql "$URL" -X -q -c "create database medir" >/dev/null
  URL="postgresql://postgres:${CLAVE}@127.0.0.1:${PG_PORT}/medir"
  for m in supabase/migrations/*.sql; do psql "$URL" -X -q -v ON_ERROR_STOP=1 -f "$m"; done
else
  URL="$MEDIR_URL"
fi

PSQL=(psql "$URL" -X -q -v ON_ERROR_STOP=1)
echo "▶ sembrando ${ESTAMPAS} estampas sintéticas (${JUEGOS} juegos, ~30% con segunda versión, ~10% match perfecto)"
"${PSQL[@]}" <<SQL
insert into public.estampas (id, archivada_en)
select gen_random_uuid(), case when g % 20 = 0 then now() end from generate_series(1, ${ESTAMPAS}) g;

create temp table base as select id, row_number() over (order by id) as n from public.estampas;

insert into public.estampa_versiones (estampa_id, numero_version, version_formato, datos)
select id, 1, 1, jsonb_build_object(
  'juego', jsonb_build_object('nombre', 'Juego-' || (n % ${JUEGOS}), 'genero', case when n % 3 = 0 then 'RTS' else 'FPS' end,
                              'fecha', to_char(date '2024-01-01' + (n % 700)::int, 'YYYY-MM-DD')),
  'sistema', jsonb_build_object('mouse', 'Marca Modelo', 'dpi', 400 + (n % 8) * 100),
  'enJuego', jsonb_build_object('sensibilidad', 1.5, 'rawInput', 'encendido'),
  'resultado', jsonb_build_object('rango', 'R' || (n % 12), 'certeza', 'medido', 'matchPerfecto', (n % 10 = 0)))
from base;

insert into public.estampa_versiones (estampa_id, numero_version, version_formato, datos)
select b.id, 2, 1, v.datos || jsonb_build_object('notas', 'corregida')
from base b join public.estampa_versiones v on v.estampa_id = b.id and v.numero_version = 1
where b.n % 10 < 3;
analyze;
SQL
echo "   estampas: $("${PSQL[@]}" -tAc 'select count(*) from estampas') · versiones: $("${PSQL[@]}" -tAc 'select count(*) from estampa_versiones')"

ID="$("${PSQL[@]}" -tAc "select id from estampas order by id limit 1 offset 1234")"
medir() { # medir <etiqueta> <sql>
  local ms
  ms="$("${PSQL[@]}" -tAc "explain (analyze, timing off, summary on) $2" | grep -E 'Execution Time' | sed -E 's/.*: ([0-9.]+) ms.*/\1/')"
  printf '   %-46s %8s ms\n' "$1" "$ms"
}
ORDEN="order by fecha desc nulls last, creada_en desc"
COLS="id,numero_version,total_versiones,archivada,creada_en,version_creada_en,datos"
echo "▶ tiempos (Execution Time)"
medir "listar sin filtros (limit 51)"            "select ${COLS} from estampas_vigentes where archivada = false ${ORDEN} limit 51"
medir "listar por juego (ilike, limit 51)"       "select ${COLS} from estampas_vigentes where juego ilike 'Juego-7' and archivada = false ${ORDEN} limit 51"
medir "listar por género"                        "select ${COLS} from estampas_vigentes where genero = 'RTS' and archivada = false ${ORDEN} limit 51"
medir "matches_perfectos (limit 51)"             "select ${COLS} from estampas_vigentes where match_perfecto = true and archivada = false ${ORDEN} limit 51"
medir "mejor_por_juego (juego + match)"          "select ${COLS} from estampas_vigentes where juego ilike 'Juego-7' and match_perfecto = true and archivada = false ${ORDEN} limit 51"
medir "ver_estampa (por id, vigente)"            "select ${COLS} from estampas_vigentes where id = '${ID}'"
medir "historial_versiones (por id)"             "select ${COLS} from estampas_historial where id = '${ID}' order by numero_version"
medir "exportar: primera página (500)"           "select ${COLS} from estampas_vigentes order by creada_en, id, numero_version limit 500"
medir "exportar: página lejana (offset 15000)"   "select ${COLS} from estampas_historial order by creada_en, id, numero_version limit 500 offset 15000"
