#!/usr/bin/env bash
# Deploy en VPS: actualiza código desde Git y reconstruye contenedores.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

REMOTE="${DEPLOY_REMOTE:-origin}"
BRANCH="${DEPLOY_BRANCH:-master}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Error: no es un directorio Git (falta .git)." >&2
  exit 1
fi

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "=========================================================================="
  echo "ADVERTENCIA: hay cambios locales (archivos modificados o sin trackear)."
  echo "El próximo 'git reset --hard ${REMOTE}/${BRANCH}' descartará cambios en archivos trackeados."
  echo "=========================================================================="
  git status -sb
  read -r -p "¿Continuar de todos modos? [y/N] " reply
  case "${reply:-}" in
    y | Y) ;;
    *)
      echo "Abortado."
      exit 1
      ;;
  esac
fi

echo ">>> git fetch ${REMOTE}"
git fetch "${REMOTE}"

echo ">>> git reset --hard ${REMOTE}/${BRANCH}"
git reset --hard "${REMOTE}/${BRANCH}"

echo ">>> docker compose down"
docker compose down

echo ">>> docker compose up -d --build"
docker compose up -d --build

echo ">>> Últimas líneas de logs del servicio backend:"
docker compose logs --tail=120 backend

echo "Deploy finalizado."
