#!/bin/bash
# Despliega en el Mac Mini lo commiteado de ladder-lab y sens-lab, desde el ThinkPad.
# Va por git archive: el Mac no recibe acceso a GitHub. Uso: deploy/desplegar.sh [ladder-lab] [sens-lab]
set -euo pipefail

DEV="${LAB_DEV:-$HOME/Volumes/Extended/github/DEVELOPMENT}"
PROYECTOS=("${@:-ladder-lab sens-lab}")
read -r -a PROYECTOS <<< "${PROYECTOS[*]}"

for proyecto in "${PROYECTOS[@]}"; do
  if [ -n "$(git -C "$DEV/$proyecto" status --porcelain)" ]; then
    echo "$proyecto tiene cambios sin commitear: no despliego" >&2
    exit 1
  fi
done

for proyecto in "${PROYECTOS[@]}"; do
  commit=$(git -C "$DEV/$proyecto" rev-parse --short HEAD)
  echo "▶ $proyecto @ $commit"
  git -C "$DEV/$proyecto" archive --format=tar HEAD |
    ssh mac-mini "rm -rf ~/apps/$proyecto && mkdir -p ~/apps/$proyecto && tar -xf - -C ~/apps/$proyecto"
  ssh -n mac-mini "export PATH=/usr/local/bin:/opt/homebrew/bin:\$PATH; cd ~/apps/$proyecto && docker build -q -t $proyecto:local -t $proyecto:$commit ."
done

scp -q "$DEV/ladder-lab/deploy/docker-compose.yml" "$DEV/ladder-lab/deploy/nginx.conf" \
  "$DEV/ladder-lab/deploy/respaldar-mac.sh" mac-mini:apps/lab-stack/ </dev/null
ssh -n mac-mini "export PATH=/usr/local/bin:/opt/homebrew/bin:\$PATH; cd ~/apps/lab-stack && docker compose up -d --remove-orphans && docker compose ps --format '{{.Name}} {{.Status}}'"
