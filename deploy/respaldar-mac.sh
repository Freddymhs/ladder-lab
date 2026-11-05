#!/bin/bash
# Respaldo diario en el Mac Mini (launchd). Si termina bien, avisa a Uptime Kuma;
# si no llega ese aviso en 25 h, Kuma alerta por Telegram.
set -uo pipefail
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH

RAIZ="${LAB_RESPALDOS:-$HOME/respaldos}"
ENTORNO="$HOME/.config/lab/ladder-lab.env"
PUSH="$HOME/.config/lab/kuma-push-url"
SENS_URL="${SENS_URL:-http://127.0.0.1:3012/candidatas/exportar}"
RETENCION_DIAS=30
RED=lab_default

mkdir -p "$RAIZ/ladder-lab" "$RAIZ/sens-lab"
fallos=0

docker run --rm --user "$(id -u):$(id -g)" --network "$RED" --env-file "$ENTORNO" \
  -v "$RAIZ/ladder-lab:/respaldos" -e RESPALDO_DIR=/respaldos \
  ladder-lab:local node dist/respaldo.js
codigo=$?
if [ "$codigo" -ne 0 ]; then
  echo "ladder-lab: código $codigo"
  fallos=1
fi

destino="$RAIZ/sens-lab/candidatas-$(date -u +%Y%m%dT%H%M%SZ).json"
if ! curl -fsS -m 60 -o "$destino" "$SENS_URL"; then
  echo "sens-lab: falló la descarga"
  rm -f "$destino"
  fallos=1
fi
find "$RAIZ/sens-lab" -name 'candidatas-*.json' -mtime +"$RETENCION_DIAS" -delete

if [ "$fallos" -eq 0 ] && [ -f "$PUSH" ]; then
  curl -fsS -m 15 -o /dev/null "$(cat "$PUSH")?status=up&msg=OK"
fi
echo "$(date -u +%FT%TZ) respaldo terminado, fallos=$fallos"
exit "$fallos"
