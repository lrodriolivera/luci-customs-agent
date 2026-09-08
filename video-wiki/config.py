"""
Configuración del pipeline video-wiki.

Toda la configuración del proyecto en un solo lugar. Si necesitas modificar
qué se captura, qué voz usa, qué resolución, etc. — edita aquí.
"""
from pathlib import Path
import os
from dotenv import load_dotenv

# === Carga .env ===
ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

# === Plataforma ===
PLATFORM_URL = os.getenv("PLATFORM_URL", "https://aduanas.strixai.es")
LOGIN_EMAIL = os.getenv("LOGIN_EMAIL", "luis.rodriguez@strixai.es")
LOGIN_PASSWORD = os.getenv("LOGIN_PASSWORD", "test123")

# === Wiki source ===
# Carpeta canónica del wiki (no la copia servida en frontend/public).
WIKI_DIR = ROOT.parent / "docs" / "wiki"
WIKI_IMG_DIR = WIKI_DIR / "img"

# === Output ===
OUTPUT_DIR = ROOT / "output"
SCREENSHOTS_DIR = OUTPUT_DIR / "screenshots"
AUDIO_DIR = OUTPUT_DIR / "audio"
VIDEO_OUT = OUTPUT_DIR / "luci-video-wiki.mp4"

# === Video ===
RESOLUTION = (1280, 720)
FPS = 24
INTRO_DURATION = 5.0          # Segundos de intro/título
OUTRO_DURATION = 5.0          # Segundos de cierre
MIN_SECTION_DURATION = 8.0    # Mínimo aunque la narración sea muy corta
TRANSITION_FADE = 0.5         # Cross-fade entre secciones (s)

# === ElevenLabs ===
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "erKgR0s8Y67t4iiHuA9R")
ELEVENLABS_MODEL = "eleven_multilingual_v2"
ELEVENLABS_VOICE_SETTINGS = {
    "stability": 0.55,
    "similarity_boost": 0.75,
    "style": 0.0,
    "use_speaker_boost": True,
}

# === Playwright ===
PLAYWRIGHT_VIEWPORT = {"width": RESOLUTION[0], "height": RESOLUTION[1]}
PLAYWRIGHT_TIMEOUT_MS = 25_000
PLAYWRIGHT_SCREENSHOT_FULL_PAGE = False  # solo viewport para video


# === GUION DEL VIDEO ===
# Cada entrada describe una sección del video.
# - id, title, wiki_source, max_paragraphs, max_chars: igual que antes (control texto).
# - capture_steps:  LISTA de pantallas a recorrer durante la sección (Playwright
#                   las visita en orden grabando vídeo). Cada paso:
#                     {"url": "/ruta", "wait_ms": 3000, "scroll": 0|400|...}
#                   El video resultante es la duración total wait_ms sumados +
#                   tiempo de carga, y luego se recorta/extiende al audio.
# - fallback_image: imagen estática si la captura live falla o si --no-capture.
SECTIONS = [
    {
        "id": "01_intro",
        "title": "LUCI Customs Agent",
        "wiki_source": "README.md",
        "capture_steps": [
            {"url": "/", "wait_ms": 4000, "scroll": 0},
            {"url": "/", "wait_ms": 4000, "scroll": 400},
        ],
        "fallback_image": "dashboard.png",
        "max_paragraphs": 1,
        "max_chars": 350,
    },
    {
        "id": "02_empezando",
        "title": "Empezando con LUCI",
        "wiki_source": "01-empezando.md",
        "capture_steps": [
            {"url": "/", "wait_ms": 3500, "scroll": 0},
            {"url": "/expeditions", "wait_ms": 3500, "scroll": 0},
            {"url": "/wiki", "wait_ms": 4000, "scroll": 0},
        ],
        "fallback_image": "dashboard.png",
        "max_paragraphs": 2,
        "max_chars": 600,
    },
    {
        "id": "03_expedientes",
        "title": "Crear un expediente",
        "wiki_source": "03-flujos-diarios/crear-expediente.md",
        "capture_steps": [
            {"url": "/expeditions", "wait_ms": 3000, "scroll": 0},
            {"url": "/expeditions", "wait_ms": 3500, "scroll": 200},
            {"url": "/expeditions/new", "wait_ms": 4500, "scroll": 0},
        ],
        "fallback_image": "expedientes-lista.png",
        "max_paragraphs": 2,
        "max_chars": 600,
    },
    {
        "id": "04_h1",
        "title": "Declarar una H1 de importación",
        "wiki_source": "03-flujos-diarios/declarar-h1-importacion.md",
        "capture_steps": [
            {"url": "/declarations", "wait_ms": 3500, "scroll": 0},
            {"url": "/declarations/h1/new", "wait_ms": 4000, "scroll": 0},
            {"url": "/declarations/h1/new", "wait_ms": 3500, "scroll": 400},
        ],
        "fallback_image": "declaraciones-lista.png",
        "max_paragraphs": 2,
        "max_chars": 600,
    },
    {
        "id": "05_h7_manifiesto",
        "title": "Manifiestos masivos H7",
        "wiki_source": "03-flujos-diarios/manifiesto-csv-masivo.md",
        "capture_steps": [
            {"url": "/h7", "wait_ms": 3500, "scroll": 0},
            {"url": "/h7/new", "wait_ms": 4000, "scroll": 0},
        ],
        "fallback_image": "h7-mrn-verde.png",
        "max_paragraphs": 2,
        "max_chars": 600,
    },
    {
        "id": "06_aeat",
        "title": "Enviar a AEAT y obtener un MRN",
        "wiki_source": "03-flujos-diarios/enviar-aeat-y-mrn.md",
        "capture_steps": [
            {"url": "/aeat/certificates", "wait_ms": 3500, "scroll": 0},
            {"url": "/aeat/monitor", "wait_ms": 4500, "scroll": 0},
            {"url": "/aeat/monitor", "wait_ms": 3000, "scroll": 300},
        ],
        "fallback_image": "aeat-monitor.png",
        "max_paragraphs": 2,
        "max_chars": 600,
    },
    {
        "id": "07_calculo",
        "title": "Calcular derechos arancelarios",
        "wiki_source": "03-flujos-diarios/calcular-derechos.md",
        "capture_steps": [
            {"url": "/calculator", "wait_ms": 4000, "scroll": 0},
            {"url": "/preferences", "wait_ms": 3500, "scroll": 0},
        ],
        "fallback_image": "calculadora.png",
        "max_paragraphs": 2,
        "max_chars": 600,
    },
    {
        "id": "08_ia",
        "title": "Asistente LUCI e Inteligencia Artificial",
        "wiki_source": "05-asistente-luci-ia.md",
        "capture_steps": [
            {"url": "/ml-insights", "wait_ms": 4000, "scroll": 0},
            {"url": "/analytics", "wait_ms": 4500, "scroll": 0},
        ],
        "fallback_image": "ml-insights.png",
        "max_paragraphs": 2,
        "max_chars": 600,
    },
    {
        "id": "09_casos_reales",
        "title": "Casos reales — 4 MRN reales en AEAT",
        "wiki_source": "06-casos-reales.md",
        "capture_steps": [
            {"url": "/aeat/monitor", "wait_ms": 4000, "scroll": 0},
            {"url": "/expeditions", "wait_ms": 3500, "scroll": 0},
            {"url": "/expeditions", "wait_ms": 3500, "scroll": 300},
        ],
        "fallback_image": "aeat-monitor.png",
        "max_paragraphs": 2,
        "max_chars": 700,
    },
    {
        "id": "10_wiki",
        "title": "Manual integrado en la plataforma",
        "wiki_source": "07-atajos-y-trucos.md",
        "capture_steps": [
            {"url": "/wiki", "wait_ms": 3500, "scroll": 0},
            {"url": "/wiki/03-flujos-diarios/declarar-h1-importacion", "wait_ms": 4500, "scroll": 0},
        ],
        "fallback_image": "dashboard.png",
        "max_paragraphs": 2,
        "max_chars": 500,
    },
]


# Carpeta donde se guardan los .webm grabados por Playwright
VIDEO_CAPTURES_DIR = OUTPUT_DIR / "captures"


def ensure_output_dirs():
    """Crea las carpetas de output si no existen."""
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    VIDEO_CAPTURES_DIR.mkdir(parents=True, exist_ok=True)


def validate_env():
    """Comprueba que las variables críticas existen."""
    errors = []
    if not ELEVENLABS_API_KEY:
        errors.append("ELEVENLABS_API_KEY vacía en .env")
    if not WIKI_DIR.exists():
        errors.append(f"WIKI_DIR no existe: {WIKI_DIR}")
    return errors
