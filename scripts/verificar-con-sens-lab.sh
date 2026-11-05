#!/usr/bin/env bash
# Prueba el contrato JSON entre ladder-lab y sens-lab con el código REAL de los dos.
# No modifica sens-lab: solo importa su importador (lectura). Requiere pnpm y tsx (devDependency).
#
# Uso: scripts/verificar-con-sens-lab.sh        (SENS_LAB_DIR para apuntar a otra carpeta)
set -euo pipefail
cd "$(dirname "$0")/.."

SENS_LAB="${SENS_LAB_DIR:-$(cd .. && pwd)/sens-lab}"
if [ ! -d "$SENS_LAB/src/domain/estampa" ]; then
  echo "sens-lab no encontrado en $SENS_LAB (usa SENS_LAB_DIR): NO se verificó nada" >&2
  exit 2
fi

SALIDAS="$(mktemp -d)"
trap 'rm -rf "$SALIDAS"' EXIT

echo "▶ ladder-lab genera salidas reales y valida los fixtures de sens-lab"
pnpm exec tsx --tsconfig tsconfig.json scripts/verificacion/generar-salidas.ts "$SALIDAS" "$SENS_LAB"
echo "▶ sens-lab consume esas salidas con su importador real"
pnpm exec tsx --tsconfig "$SENS_LAB/tsconfig.json" scripts/verificacion/consumir-en-sens-lab.ts \
  "$SALIDAS" "$SENS_LAB" "$PWD/docs/formato/ejemplos"
