#!/bin/bash
# Copia fuera del Mac y de Neon, y una foto diaria de la bóveda de notas (systemd --user, con recuperación si el ThinkPad
# estuvo apagado). Sin --delete: la poda del Mac no debe vaciar esta copia.
set -uo pipefail

RAIZ="${LAB_COPIA:-$HOME/respaldos/lab}"
URI_DUENO="$HOME/.config/lab/owner-uri"
# Ruta fija: el pg_dump de Ubuntu es un wrapper que puede elegir otra versión y fallar.
PG_DUMP=/usr/lib/postgresql/18/bin/pg_dump
RETENCION_DIAS=90

mkdir -p "$RAIZ/mac" "$RAIZ/pg_dump"
fallos=0

if ! rsync -a --timeout=60 mac-mini:respaldos/ "$RAIZ/mac/"; then
  echo "rsync: falló (¿Mac o Tailscale abajo?)"
  fallos=1
fi

destino="$RAIZ/pg_dump/lab-$(date -u +%Y%m%dT%H%M%SZ).dump"
if "$PG_DUMP" -Fc --no-owner -f "$destino" "$(cat "$URI_DUENO")"; then
  echo "pg_dump: $(wc -c < "$destino") bytes"
else
  echo "pg_dump: falló"
  rm -f "$destino"
  fallos=1
fi
find "$RAIZ/pg_dump" -name 'lab-*.dump' -mtime +"$RETENCION_DIAS" -delete

# La bóveda de notas vive solo en el Mac (sin git ni Time Machine): una foto fechada por día.
mkdir -p "$RAIZ/boveda"
foto="$RAIZ/boveda/boveda-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
if ssh -o ConnectTimeout=15 -o BatchMode=yes mac-mini 'COPYFILE_DISABLE=1 tar --no-xattrs -C "$HOME" -czf - boveda' > "$foto" && [ -s "$foto" ]; then
  echo "boveda: $(wc -c < "$foto") bytes"
else
  echo "boveda: falló"
  rm -f "$foto"
  fallos=1
fi
find "$RAIZ/boveda" -name 'boveda-*.tar.gz' -mtime +"$RETENCION_DIAS" -delete

echo "$(date -u +%FT%TZ) copia terminada, fallos=$fallos"
exit "$fallos"
