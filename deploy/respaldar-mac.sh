#!/bin/bash
# Respaldo diario en el Mac Mini (launchd). Si termina bien, avisa a Uptime Kuma;
# si no llega ese aviso en 25 h, Kuma alerta por Telegram.
set -uo pipefail
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH

RAIZ="${LAB_RESPALDOS:-$HOME/respaldos}"
ENTORNO="$HOME/.config/lab/ladder-lab.env"
PUSH="$HOME/.config/lab/kuma-push-url"
SENS_BASE="${SENS_BASE:-http://127.0.0.1:3012}"
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

# Baja una exportación de sens-lab a $RAIZ/sens-lab/<nombre>-<fecha>.json y poda las viejas.
respaldar_sens_lab() {
  local nombre="$1" ruta="$2"
  local destino="$RAIZ/sens-lab/$nombre-$(date -u +%Y%m%dT%H%M%SZ).json"
  if ! curl -fsS -m 60 -o "$destino" "$SENS_BASE/$ruta"; then
    echo "sens-lab $nombre: falló la descarga"
    rm -f "$destino"
    fallos=1
  fi
  find "$RAIZ/sens-lab" -name "$nombre-*.json" -mtime +"$RETENCION_DIAS" -delete
}

respaldar_sens_lab candidatas candidatas/exportar
respaldar_sens_lab calibraciones calibraciones/exportar

if [ "$fallos" -eq 0 ] && [ -f "$PUSH" ]; then
  curl -fsS -m 15 -o /dev/null "$(cat "$PUSH")?status=up&msg=OK"
fi
echo "$(date -u +%FT%TZ) respaldo terminado, fallos=$fallos"
exit "$fallos"
