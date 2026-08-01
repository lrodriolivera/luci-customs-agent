# Despliegue LUCI — homelab

Este directorio es un **checkout de git** del repo Forgejo
`https://git.strixai.es/strixai/luci-customs-agent` (rama `main`).

Convertido el 1/Ago/2026. Antes era una copia manual de ficheros, y por eso
varios cambios hechos aqui (SMTP de Resend, el fix de `formaRepresentacion`
de AEAT, toda la migracion a Bedrock del ai-service, los Dockerfile) vivieron
meses sin estar en el repo.

## Actualizar a la ultima version

```bash
cd /srv/homelab/luci
git pull
docker compose build luci-backend luci-frontend luci-ai
docker compose up -d
```

Construir solo lo que cambio es mas rapido: `docker compose build luci-backend`.

## Antes de tocar nada

```bash
git status    # debe estar limpio salvo lo no versionado (ver abajo)
git log -1    # que version corre
```

Si `git status` muestra ficheros modificados, **alguien edito el servidor a
mano**. Eso vuelve a abrir el agujero que esta conversion cerro: commitea o
descarta esos cambios antes de seguir.

## Lo que NO esta en git (y debe seguir aqui)

| Ruta | Que es |
|---|---|
| `backend/.env` | Credenciales: Bedrock, Resend, AEAT, Stripe, JWT |
| `ai-service/.env` | Credenciales de Bedrock |
| `certs/strixai_fnmt.p12` | Certificado FNMT de firma AEAT |
| `data/` | Volumenes de Mongo y uploads |

Estan en `.gitignore`, asi que `git pull` y `git reset --hard` no los tocan.
Aun asi, **no hay copia de estos ficheros fuera de esta maquina**: si el disco
muere, el `.env` y el certificado se pierden. El certificado se puede
reemitir; el `.env` habria que reconstruirlo a mano.

## Backups

`backup-mongo.sh` corre por cron a diario a las 03:30 y deja los dumps en
`/srv/backups/luci/` con 30 dias de retencion. Cubre **solo Mongo**, no los
`.env` ni los certificados.

## Los .env no se hornean en la imagen

Los tres servicios tienen `.dockerignore` que excluye `.env`. Las credenciales
llegan en tiempo de ejecucion por `env_file` del compose. Antes del 1/Ago los
`COPY . .` metian el `.env` dentro de la imagen, dejando los secretos en una
capa que viaja con cualquier copia de esa imagen.
