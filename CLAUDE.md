# CLAUDE.md — LUCI Customs Agent

## Git — Repositorio

**IMPORTANTE:** Este proyecto usa Forgejo self-hosted como repositorio principal. NO hacer push a GitHub.

### Remote principal
```
origin: https://git.strixai.ai/strixai/luci-customs-agent.git
```
Credenciales de `strixadmin` en el CLAUDE.md global del usuario (no se versionan aquí).

### Configuración (si el remote sigue apuntando a GitHub)
```bash
git remote set-url origin "https://git.strixai.ai/strixai/luci-customs-agent.git"
```

### SSH alternativo
```bash
git remote set-url origin ssh://git@git.strixai.ai:2222/strixai/luci-customs-agent.git
```

### Reglas de push
- **Rama principal:** `main`
- **Siempre hacer push a Forgejo** (git.strixai.ai), NUNCA a GitHub
- Antes de cualquier push, verificar con `git remote -v` que apunta a git.strixai.ai
- Excluir siempre: `.env`, credenciales, capturas de pantalla, archivos de claves AWS

## Proyecto

LUCI es un agente de IA para clasificación aduanera automatizada (código TARIC) usando LLMs (Claude API / Amazon Bedrock). Producto SaaS B2B de STRIX AI Pioneer Solutions SL.

## Otros repos del mismo ecosistema STRIX AI

| Repo | URL Forgejo |
|---|---|
| 300dec-correos | https://git.strixai.ai/strixai/300dec-correos.git |
| strixbid | https://git.strixai.ai/strixai/strixbid.git |
| strixai-landing | https://git.strixai.ai/strixai/strixai-landing.git |
| pocstocklogistic | https://git.strixai.ai/strixai/pocstocklogistic.git |
| strix-bucanera | https://git.strixai.ai/strixai/strix-bucanera.git |
