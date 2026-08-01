#!/usr/bin/env bash
#
# Backup diario de la BD de LUCI (Mongo en el contenedor luci-mongo).
#
# El Mongo del EC2 se perdio en la migracion de AWS (15/Jul/2026) y hasta el
# 1/Ago/2026 el homelab no tenia ninguna copia: el unico ejemplar de los 21.946
# codigos TARIC y de las declaraciones vivia en un bind mount sobre disco sin
# RAID. Este script cierra ese agujero.
#
# Uso: ./backup-mongo.sh   (sin argumentos; pensado para cron)

set -Eeuo pipefail

readonly CONTAINER="luci-mongo"
readonly DB="luci"
readonly DEST="/srv/backups/luci"
readonly RETENTION_DAYS=30
readonly STAMP="$(date +%Y%m%d-%H%M%S)"
readonly ARCHIVE="${DEST}/luci-${STAMP}.archive.gz"
readonly LOG="${DEST}/backup.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

# Cualquier fallo debe ser ruidoso y no dejar un archivo a medias que parezca
# un backup valido.
on_error() {
  log "ERROR: backup FALLIDO en linea ${1} (exit ${2})"
  [[ -f "$ARCHIVE" ]] && rm -f "$ARCHIVE" && log "Archivo parcial eliminado: ${ARCHIVE}"
  exit "${2}"
}
trap 'on_error ${LINENO} $?' ERR

mkdir -p "$DEST"

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  log "ERROR: el contenedor ${CONTAINER} no esta corriendo. Backup abortado."
  exit 1
fi

log "Iniciando backup de '${DB}' desde ${CONTAINER}"

# --archive a stdout: evita escribir dentro del contenedor y necesitar un docker cp.
docker exec "$CONTAINER" mongodump --db="$DB" --archive --gzip > "$ARCHIVE"

# Un dump vacio pesa unos pocos cientos de bytes; por debajo de 1 KB algo fue mal
# aunque mongodump haya devuelto 0.
readonly SIZE=$(stat -c%s "$ARCHIVE")
if (( SIZE < 1024 )); then
  log "ERROR: el archivo resultante es sospechosamente pequeno (${SIZE} bytes)."
  rm -f "$ARCHIVE"
  exit 1
fi

# Verificar que el archivo es restaurable de verdad, no solo que existe.
# --dryRun lee el archivo entero sin escribir en la BD.
docker exec -i "$CONTAINER" mongorestore --archive --gzip --dryRun < "$ARCHIVE" >/dev/null 2>&1
log "Backup OK: ${ARCHIVE} ($(numfmt --to=iec "$SIZE")) - integridad verificada"

# Retencion: borrar copias mas viejas que RETENTION_DAYS.
readonly DELETED=$(find "$DEST" -name 'luci-*.archive.gz' -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)
(( DELETED > 0 )) && log "Retencion: ${DELETED} copia(s) de mas de ${RETENTION_DAYS} dias eliminadas"

log "Copias actuales: $(find "$DEST" -name 'luci-*.archive.gz' | wc -l) ocupando $(du -sh "$DEST" | cut -f1)"
