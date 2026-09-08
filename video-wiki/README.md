# video-wiki

Genera un video divulgativo de LUCI Customs Agent a partir del wiki existente en `docs/wiki/`. Sin inventar contenido: el guión sale literalmente del Markdown, las capturas vienen de las E2E (con captura live opcional vía Playwright), y la voz se sintetiza con ElevenLabs.

## Uso

```bash
cd video-wiki
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env  # ya está rellenado con la API key de strixai
python pipeline.py --check         # comprueba config
python pipeline.py --extract-only  # ver el guión sin capturar/narrar
python pipeline.py                 # pipeline completo → output/luci-video-wiki.mp4
```

Otras flags útiles: `--no-capture` (usa solo capturas estáticas del wiki), `--no-audio` (video sin voz). Configurar secciones en `config.py` → `SECTIONS`.
