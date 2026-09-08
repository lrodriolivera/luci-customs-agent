#!/usr/bin/env python3
"""
Pipeline LUCI Video-Wiki.

Genera un video divulgativo de la plataforma LUCI a partir del wiki
existente en `docs/wiki/`. Sin inventar contenido: el guión sale
literalmente de los Markdown del wiki, las imágenes vienen de las
capturas E2E ya existentes (con captura live opcional vía Playwright),
y la voz se sintetiza con ElevenLabs.

Etapas:
1. extract_script:    parsea cada wiki_source de SECTIONS y produce un texto
                      narrativo limpio (sin Markdown, sin enlaces, etc.).
2. capture_visuals:   intenta capturar la URL configurada con Playwright; si
                      falla o no procede, usa la imagen fallback del wiki.
3. synthesize_audio:  manda cada texto a ElevenLabs y guarda MP3 por sección.
4. assemble_video:    construye el video final con MoviePy (intro, secciones
                      con voz + imagen, transiciones, outro).

Uso:
    python pipeline.py --check         # valida config y dependencias
    python pipeline.py --extract-only  # solo extrae el guión
    python pipeline.py --no-capture    # usa solo fallback images
    python pipeline.py                 # pipeline completo
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Optional

import requests

import config


# ============================================================
# 1. EXTRACT SCRIPT (Markdown -> texto narrativo)
# ============================================================

def _strip_markdown(text: str) -> str:
    """Convierte Markdown en texto plano apto para narración."""
    # Eliminar encabezados (# ## ###)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    # Eliminar imágenes ![alt](url)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)
    # Convertir [texto](url) a "texto"
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    # Quitar bloques de código
    text = re.sub(r"```[\s\S]*?```", "", text)
    # Quitar inline code `x` -> x
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Quitar separadores de tabla y celdas
    text = re.sub(r"^\s*\|.*\|\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\|?[\s:|-]+\|\s*$", "", text, flags=re.MULTILINE)
    # Bold/italic markers
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    # Listas: convertir bullet a "Punto:" para que la voz lo lea natural
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
    # Blockquotes
    text = re.sub(r"^\s*>\s*", "", text, flags=re.MULTILINE)
    # Líneas separadoras
    text = re.sub(r"^[-=]{3,}\s*$", "", text, flags=re.MULTILINE)
    # Múltiples saltos de línea -> uno solo
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Espacios múltiples
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


_NAV_PATTERNS = (
    "← volver", "← índice", "siguiente:", "[← ", "← anterior",
    "← flujos", "← pantallas", "← inicio", "índice general",
    "navegación:", "ir al índice"
)


def _extract_paragraphs(md_text: str, max_paragraphs: int, max_chars: int) -> str:
    """Toma los primeros N párrafos no vacíos hasta max_chars.

    Filtra líneas de navegación del wiki (breadcrumbs ← Flujos · Índice etc.)
    y descarta párrafos que quedan «huérfanos» tras quitar Markdown.
    """
    plain = _strip_markdown(md_text)
    paragraphs = [p.strip() for p in plain.split("\n\n") if p.strip()]

    # Por cada párrafo, además de filtrarlo entero, limpio líneas-nav que se
    # cuelan en su interior (típico al inicio: «Título\n← X · Y\nTexto real…»).
    clean = []
    for p in paragraphs:
        # Quitar líneas dentro del párrafo que son nav-only
        kept = []
        for line in p.split("\n"):
            low = line.strip().lower()
            if any(low.startswith(np) for np in _NAV_PATTERNS):
                continue
            if low.startswith("←") and " · " in low:
                continue
            kept.append(line.strip())
        clean_p = " ".join(filter(None, kept))
        if len(clean_p) < 40:
            continue
        # Si tras limpiar empieza por nav y luego tiene texto, ya quitamos.
        clean.append(clean_p)
        if len(clean) >= max_paragraphs:
            break

    out = " ".join(clean)
    # Múltiples espacios consecutivos -> uno
    out = re.sub(r"\s+", " ", out).strip()

    if len(out) > max_chars:
        cut = out[:max_chars]
        last_dot = cut.rfind(". ")
        if last_dot > max_chars * 0.6:
            out = cut[:last_dot + 1]
        else:
            out = cut.rsplit(" ", 1)[0] + "."
    return out


SCRIPT_FILE = config.OUTPUT_DIR / "script.json"


def extract_script(use_saved: bool = True) -> list[dict]:
    """Lee cada wiki_source y produce el guión sección a sección.

    Si existe `output/script.json` y use_saved=True, usa ese archivo en vez
    de re-extraer del wiki. Esto permite editar el guión a mano y mantener
    las correcciones entre ejecuciones.

    Para forzar re-extracción del wiki: pasar use_saved=False (CLI: --refresh-script).
    """
    if use_saved and SCRIPT_FILE.exists():
        print(f"📖 Cargando guión desde {SCRIPT_FILE} (editable a mano)")
        saved = json.loads(SCRIPT_FILE.read_text(encoding="utf-8"))
        # Combinar con SECTIONS para mantener URL captura, fallback, etc. actualizados
        section_by_id = {s["id"]: s for s in config.SECTIONS}
        merged = []
        for entry in saved:
            base = section_by_id.get(entry["id"], {})
            merged.append({**base, **entry})
        return merged

    if not config.WIKI_DIR.exists():
        raise FileNotFoundError(f"Wiki source no existe: {config.WIKI_DIR}")

    print("📖 Extrayendo guión del wiki (sin caché)...")
    script = []
    for sec in config.SECTIONS:
        md_path = config.WIKI_DIR / sec["wiki_source"]
        if not md_path.exists():
            print(f"⚠️  [{sec['id']}] {sec['wiki_source']} no encontrado — marcado como [PENDIENTE]")
            text = "[PENDIENTE — sección no disponible en el wiki]"
        else:
            md = md_path.read_text(encoding="utf-8")
            text = _extract_paragraphs(md, sec["max_paragraphs"], sec["max_chars"])
            if not text:
                text = f"[PENDIENTE — sin contenido narrable en {sec['wiki_source']}]"

        script.append({
            **sec,
            "narration": text,
        })
    return script


def save_script(script: list[dict]) -> Path:
    """Vuelca el guión a output/script.json para que pueda editarse a mano.
    Solo guarda los campos esenciales (id, title, narration); el resto vive
    en config.py SECTIONS."""
    config.ensure_output_dirs()
    minimal = [
        {"id": s["id"], "title": s["title"], "narration": s["narration"]}
        for s in script
    ]
    SCRIPT_FILE.write_text(
        json.dumps(minimal, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return SCRIPT_FILE


def print_script(script: list[dict]) -> None:
    print("\n" + "=" * 70)
    print("GUIÓN DEL VIDEO")
    print("=" * 70)
    total_chars = 0
    for sec in script:
        print(f"\n--- [{sec['id']}] {sec['title']} ---")
        print(f"Fuente: {sec.get('wiki_source', '(N/A)')}")
        steps = sec.get("capture_steps") or []
        if steps:
            print(f"Recorrido ({len(steps)} pantallas):")
            for s in steps:
                print(f"   → {s['url']} (wait {s.get('wait_ms', 3000)}ms, scroll {s.get('scroll', 0)})")
        else:
            print("Recorrido: (sin pasos — usará fallback estático)")
        print(f"Fallback img: {sec.get('fallback_image', '(N/A)')}")
        print(f"Narración ({len(sec['narration'])} chars):")
        print(f"  {sec['narration'][:300]}{'...' if len(sec['narration']) > 300 else ''}")
        total_chars += len(sec['narration'])

    avg_speech_rate_cps = 14.5  # ElevenLabs es-ES voz adulta normal
    total_audio_seconds = total_chars / avg_speech_rate_cps
    intro_outro = config.INTRO_DURATION + config.OUTRO_DURATION
    total_duration = total_audio_seconds + intro_outro + (len(script) - 1) * config.TRANSITION_FADE

    print("\n" + "=" * 70)
    print(f"RESUMEN: {len(script)} secciones, {total_chars} caracteres totales")
    print(f"Duración estimada del video: {total_duration:.0f}s ({total_duration/60:.1f} min)")
    print(f"  - Intro/Outro: {intro_outro:.0f}s")
    print(f"  - Narración: ~{total_audio_seconds:.0f}s")
    print(f"  - Transiciones: ~{(len(script)-1)*config.TRANSITION_FADE:.0f}s")
    print("=" * 70)


# ============================================================
# 2. CAPTURE VISUALS (Playwright o fallback wiki/img)
# ============================================================

def capture_visuals(script: list[dict], skip_live: bool = False, force: bool = False) -> list[dict]:
    """Captura una secuencia de pantallas por sección con Playwright.

    Para cada sección recorre `capture_steps` (lista de URLs + scroll + esperas)
    grabando el viewport en .webm. Resultado: un archivo `output/captures/{id}.webm`
    por sección, que el ensamblador usa como VideoFileClip sincronizado al audio.

    Fallbacks (en orden):
      1. Si skip_live=True → usa solo screenshot fallback estático.
      2. Si la grabación de una sección falla → screenshot del wiki.
      3. Si Playwright no está → todas con fallback estático.
    """
    config.ensure_output_dirs()

    # Modo --no-capture: no live, solo fallback estático
    if skip_live:
        print("ℹ️  --no-capture activo: usando solo imágenes fallback del wiki.")
        for sec in script:
            sec["screenshot"] = _resolve_fallback(sec)
            sec["video_capture"] = None
        return script

    # Reusar capturas de video ya hechas. Preferimos .mp4; si solo hay .webm,
    # convertimos al vuelo.
    def _cached_video(sec_id: str) -> Optional[str]:
        mp4 = config.VIDEO_CAPTURES_DIR / f"{sec_id}.mp4"
        webm = config.VIDEO_CAPTURES_DIR / f"{sec_id}.webm"
        if mp4.exists():
            return str(mp4)
        if webm.exists():
            _webm_to_mp4(webm, mp4)
            if mp4.exists():
                return str(mp4)
            return str(webm)
        return None

    if not force:
        cached = [_cached_video(s["id"]) for s in script]
        if all(cached):
            print("✓ Todas las capturas de vídeo ya están en cache, saltando Playwright.")
            for sec, v in zip(script, cached):
                sec["video_capture"] = v
                ss = config.SCREENSHOTS_DIR / f"{sec['id']}.png"
                sec["screenshot"] = str(ss) if ss.exists() else _resolve_fallback(sec)
            return script

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("⚠️  Playwright no instalado. Usando fallback images.")
        for sec in script:
            sec["screenshot"] = _resolve_fallback(sec)
            sec["video_capture"] = None
        return script

    print(f"📹 Grabando recorridos con Playwright contra {config.PLATFORM_URL}...")
    # Obtener token JWT vía API (se inyecta manualmente en cada context).
    token = None
    user = None
    try:
        api = f"{config.PLATFORM_URL}/api/auth/login"
        r = requests.post(api, json={"email": config.LOGIN_EMAIL, "password": config.LOGIN_PASSWORD},
                          timeout=15, verify=False)
        if r.status_code == 200:
            data = r.json().get("data", {})
            token = data.get("token")
            user = data.get("user")
            print(f"  ✓ Login API OK, JWT capturado.")
        else:
            print(f"  ⚠️  Login API HTTP {r.status_code}")
    except Exception as e:
        print(f"  ⚠️  Login API falló: {e}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # 1. Pre-context (sin recording) para hacer el login real y obtener un
        #    storage_state con el localStorage POBLADO. Esto evita que la
        #    grabación posterior incluya la pantalla de login.
        storage = None
        if token:
            login_ctx = browser.new_context(
                viewport=config.PLAYWRIGHT_VIEWPORT,
                ignore_https_errors=True,
            )
            user_json = json.dumps(user or {})
            init_js = (
                f"try {{"
                f"  localStorage.setItem('token', {token!r});"
                f"  localStorage.setItem('user', {user_json!r});"
                f"  localStorage.setItem('i18nextLng','es');"
                f"  localStorage.setItem('cookieConsent','accepted');"
                f"  localStorage.setItem('cookies-accepted','true');"
                f"}} catch(e) {{}}"
            )
            login_ctx.add_init_script(init_js)
            try:
                lp = login_ctx.new_page()
                lp.goto(config.PLATFORM_URL, timeout=15_000, wait_until="domcontentloaded")
                lp.wait_for_timeout(1500)
                lp.close()
                storage = login_ctx.storage_state()
                print(f"  ✓ storage_state preparado con localStorage autenticado")
            except Exception as e:
                print(f"  ⚠️  Pre-navegación login falló: {e}")
            finally:
                login_ctx.close()

        for sec in script:
            steps = sec.get("capture_steps") or []
            if not steps:
                sec["screenshot"] = _resolve_fallback(sec)
                sec["video_capture"] = None
                continue

            # Crear context con grabación de vídeo Y storage autenticado
            video_dir = config.VIDEO_CAPTURES_DIR / f"_tmp_{sec['id']}"
            video_dir.mkdir(parents=True, exist_ok=True)

            try:
                ctx_kwargs = dict(
                    viewport=config.PLAYWRIGHT_VIEWPORT,
                    ignore_https_errors=True,
                    record_video_dir=str(video_dir),
                    record_video_size=config.PLAYWRIGHT_VIEWPORT,
                )
                if storage:
                    ctx_kwargs["storage_state"] = storage
                ctx = browser.new_context(**ctx_kwargs)

                # Reforzar localStorage en cada nueva página por si la SPA lo limpia
                if token:
                    user_json = json.dumps(user or {})
                    ctx.add_init_script(
                        f"try {{"
                        f"  localStorage.setItem('token', {token!r});"
                        f"  localStorage.setItem('user', {user_json!r});"
                        f"  localStorage.setItem('i18nextLng','es');"
                        f"  localStorage.setItem('cookieConsent','accepted');"
                        f"  localStorage.setItem('cookies-accepted','true');"
                        f"}} catch(e) {{}}"
                    )

                page = ctx.new_page()
                screenshot_path = config.SCREENSHOTS_DIR / f"{sec['id']}.png"

                for i, step in enumerate(steps):
                    target = f"{config.PLATFORM_URL}{step['url']}"
                    try:
                        page.goto(target, timeout=config.PLAYWRIGHT_TIMEOUT_MS,
                                  wait_until="domcontentloaded")
                        try:
                            page.wait_for_load_state("networkidle", timeout=10_000)
                        except Exception:
                            pass
                        # Cerrar banner cookies si aparece
                        try:
                            btn = page.locator("button:has-text('Aceptar')").first
                            if btn.is_visible(timeout=800):
                                btn.click(timeout=1000)
                        except Exception:
                            pass
                        # Scroll si está definido
                        if step.get("scroll"):
                            page.evaluate(f"window.scrollTo({{top:{int(step['scroll'])},behavior:'smooth'}})")
                        # Esperar el tiempo configurado para que se vea bien
                        page.wait_for_timeout(int(step.get("wait_ms", 3000)))

                        # Captura estática del primer paso (para fallback)
                        if i == 0 and not screenshot_path.exists():
                            try:
                                page.screenshot(path=str(screenshot_path),
                                                full_page=config.PLAYWRIGHT_SCREENSHOT_FULL_PAGE)
                            except Exception:
                                pass
                    except Exception as e:
                        print(f"    ⚠️  paso {i+1} falló ({step['url']}): {e}")

                page.close()
                ctx.close()  # Esto finaliza la grabación

                # Mover el .webm generado al destino esperado y convertir a MP4
                webms = list(video_dir.glob("*.webm"))
                if webms:
                    webm_path = config.VIDEO_CAPTURES_DIR / f"{sec['id']}.webm"
                    mp4_path = config.VIDEO_CAPTURES_DIR / f"{sec['id']}.mp4"
                    if webm_path.exists():
                        webm_path.unlink()
                    webms[0].rename(webm_path)
                    # Convertir a MP4 (h264) — MoviePy 1.x falla a veces con VP8/VP9 directo
                    if mp4_path.exists():
                        mp4_path.unlink()
                    _webm_to_mp4(webm_path, mp4_path)
                    sec["video_capture"] = str(mp4_path) if mp4_path.exists() else str(webm_path)
                    print(f"  ✓ {sec['id']}: {len(steps)} pantallas → {Path(sec['video_capture']).name}")
                else:
                    sec["video_capture"] = None
                    print(f"  ✗ {sec['id']}: no se generó .webm")

                # Limpiar tmp
                try:
                    for f in video_dir.iterdir():
                        f.unlink()
                    video_dir.rmdir()
                except Exception:
                    pass

                sec["screenshot"] = str(screenshot_path) if screenshot_path.exists() else _resolve_fallback(sec)

            except Exception as e:
                print(f"  ✗ {sec['id']}: {e} — usando fallback estático")
                sec["video_capture"] = None
                sec["screenshot"] = _resolve_fallback(sec)

        browser.close()
    return script


def _login(context) -> bool:
    """Inyecta token JWT en localStorage tras login API. Más rápido que UI."""
    api = f"{config.PLATFORM_URL}/api/auth/login"
    r = requests.post(api, json={"email": config.LOGIN_EMAIL, "password": config.LOGIN_PASSWORD}, timeout=15, verify=False)
    if r.status_code != 200:
        print(f"  Login API status {r.status_code}")
        return False
    data = r.json().get("data", {})
    token = data.get("token")
    user = data.get("user")
    if not token:
        return False

    # Inyectar via init_script (correrá en cada nueva página)
    js = f"""
        try {{
          localStorage.setItem('token', {token!r});
          localStorage.setItem('user', {repr(__import__('json').dumps(user))});
          localStorage.setItem('i18nextLng', 'es');
          localStorage.setItem('cookieConsent', 'accepted');
          localStorage.setItem('cookies-accepted', 'true');
        }} catch (e) {{}}
    """
    context.add_init_script(js)
    print("  ✓ Login API OK, token inyectado.")
    return True


def _resolve_fallback(sec: dict) -> str:
    """Devuelve la ruta absoluta de la imagen fallback (capturas wiki/img)."""
    fallback = config.WIKI_IMG_DIR / sec["fallback_image"]
    if fallback.exists():
        return str(fallback)
    # Último recurso: imagen vacía o primera del directorio
    candidates = list(config.WIKI_IMG_DIR.glob("*.png"))
    if candidates:
        return str(candidates[0])
    raise FileNotFoundError(f"No hay imagen fallback para {sec['id']}: {fallback}")


def _webm_to_mp4(webm_path: Path, mp4_path: Path) -> None:
    """Convierte .webm (VP8/VP9 de Playwright) a .mp4 (H.264) con ffmpeg.

    MoviePy 1.x con FFMPEG estándar a veces falla leyendo el primer frame
    de un .webm de Playwright. Convertir a H.264 es trivial y resuelve.
    """
    import subprocess
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", str(webm_path),
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-pix_fmt", "yuv420p",
                # FPS fijo + keyframes regulares (MoviePy 1.x con FPS variable
                # devuelve "failed to read first frame" intermitente).
                "-r", str(config.FPS), "-g", str(config.FPS),
                "-keyint_min", str(config.FPS),
                "-movflags", "+faststart",
                "-an",
                str(mp4_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=120,
        )
    except subprocess.CalledProcessError as e:
        print(f"     ⚠️  ffmpeg falló: {e.stderr.decode()[:200] if e.stderr else e}")
    except FileNotFoundError:
        print("     ⚠️  ffmpeg no encontrado en el sistema; se usará el .webm directo")
    except subprocess.TimeoutExpired:
        print("     ⚠️  ffmpeg tardó >120s, abortado")


# ============================================================
# 3. SYNTHESIZE AUDIO (ElevenLabs TTS)
# ============================================================

def synthesize_audio(script: list[dict]) -> list[dict]:
    """Sintetiza voz para cada sección usando ElevenLabs.

    Cachea por hash del texto narrado: si editas la narración (en script.json
    o en el wiki), el MP3 se regenera automáticamente. Si no cambia el texto,
    reusa el archivo existente y no llama a la API.
    """
    if not config.ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY no configurada en .env")

    import hashlib
    config.ensure_output_dirs()
    print(f"🎤 Sintetizando narración con ElevenLabs (voice {config.ELEVENLABS_VOICE_ID})...")

    for sec in script:
        text = sec["narration"]
        if not text or text.startswith("[PENDIENTE"):
            print(f"  - {sec['id']}: pendiente, saltando audio")
            sec["audio"] = None
            continue

        # Hash del texto para invalidar cache cuando cambie
        h = hashlib.md5(text.encode("utf-8")).hexdigest()[:8]
        out = config.AUDIO_DIR / f"{sec['id']}_{h}.mp3"

        # Limpiar versiones viejas con otro hash (mismo id pero distinto texto)
        for old in config.AUDIO_DIR.glob(f"{sec['id']}_*.mp3"):
            if old.name != out.name:
                old.unlink()
        # Compatibilidad con cache antiguo sin hash
        legacy = config.AUDIO_DIR / f"{sec['id']}.mp3"
        if legacy.exists() and legacy != out:
            legacy.unlink()

        if out.exists():
            sec["audio"] = str(out)
            print(f"  · {sec['id']}: ya existe (cache, hash={h})")
            continue

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{config.ELEVENLABS_VOICE_ID}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": config.ELEVENLABS_API_KEY,
        }
        body = {
            "text": text,
            "model_id": config.ELEVENLABS_MODEL,
            "voice_settings": config.ELEVENLABS_VOICE_SETTINGS,
        }
        try:
            r = requests.post(url, headers=headers, json=body, timeout=120)
            if r.status_code != 200:
                print(f"  ✗ {sec['id']}: HTTP {r.status_code} — {r.text[:200]}")
                sec["audio"] = None
                continue
            out.write_bytes(r.content)
            sec["audio"] = str(out)
            print(f"  ✓ {sec['id']}: {out.name} ({len(r.content)/1024:.0f} KB)")
        except Exception as e:
            print(f"  ✗ {sec['id']}: {e}")
            sec["audio"] = None
    return script


# ============================================================
# 4. ASSEMBLE VIDEO (MoviePy)
# ============================================================

def assemble_video(script: list[dict]) -> Path:
    """Construye el video final con MoviePy."""
    try:
        from moviepy.editor import (
            AudioFileClip, ImageClip, CompositeVideoClip, ColorClip,
            TextClip, concatenate_videoclips, vfx,
        )
    except ImportError:
        raise RuntimeError("moviepy no instalado. Ejecuta: pip install -r requirements.txt")

    print("🎞️  Ensamblando video con MoviePy...")
    config.ensure_output_dirs()
    W, H = config.RESOLUTION

    clips = []

    # Intro
    intro = _make_intro_clip(W, H, config.INTRO_DURATION)
    if intro:
        clips.append(intro)

    # Secciones
    for sec in script:
        clip = _make_section_clip(sec, W, H)
        if clip is not None:
            clips.append(clip)

    # Outro
    outro = _make_outro_clip(W, H, config.OUTRO_DURATION)
    if outro:
        clips.append(outro)

    if not clips:
        raise RuntimeError("Ningún clip disponible para ensamblar el video.")

    final = concatenate_videoclips(clips, method="compose", padding=-config.TRANSITION_FADE)
    final = final.crossfadein(0.3)

    print(f"   Renderizando {final.duration:.1f}s a {config.VIDEO_OUT}...")
    final.write_videofile(
        str(config.VIDEO_OUT),
        fps=config.FPS,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        threads=4,
        ffmpeg_params=["-pix_fmt", "yuv420p"],
        logger=None,
    )
    print(f"✅ Video listo: {config.VIDEO_OUT}")
    return config.VIDEO_OUT


def _text_to_png(text: str, size: tuple[int, int], font_size: int = 32,
                 color=(255, 255, 255), bg=None, multiline=True,
                 weight: str = "bold") -> Path:
    """Renderiza texto a PNG usando Pillow (sin ImageMagick).

    Devuelve la ruta del PNG. Cachea por hash del contenido + parámetros.
    """
    from PIL import Image, ImageDraw, ImageFont
    import hashlib

    # Normalizar caracteres especiales que algunas combinaciones Pillow/FreeType
    # no manejan bien (em-dash, comillas tipográficas, ellipsis…).
    repl = {
        "—": "-",   # em dash —
        "–": "-",   # en dash –
        "…": "...", # ellipsis
        "«": '"',   # «
        "»": '"',   # »
        "‘": "'",   # '
        "’": "'",   # '
        "“": '"',   # "
        "”": '"',   # "
    }
    for k, v in repl.items():
        text = text.replace(k, v)

    cache_dir = config.OUTPUT_DIR / "text-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = hashlib.md5(f"{text}|{size}|{font_size}|{color}|{bg}|{weight}".encode()).hexdigest()[:12]
    out = cache_dir / f"text_{key}.png"
    if out.exists():
        return out

    w, h = size
    img = Image.new("RGBA", (w, h), bg or (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Buscar fuente del sistema
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if weight == "bold" else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    font = None
    for fp in font_paths:
        if Path(fp).exists():
            try:
                font = ImageFont.truetype(fp, font_size)
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()

    # Word-wrap simple si multiline
    if multiline:
        lines = []
        for paragraph in text.split("\n"):
            words = paragraph.split()
            if not words:
                lines.append("")
                continue
            cur = words[0]
            for word in words[1:]:
                test = cur + " " + word
                bbox = draw.textbbox((0, 0), test, font=font)
                if bbox[2] - bbox[0] > w - 40:
                    lines.append(cur)
                    cur = word
                else:
                    cur = test
            lines.append(cur)
    else:
        lines = [text]

    # Centrar verticalmente
    line_heights = []
    for ln in lines:
        bbox = draw.textbbox((0, 0), ln, font=font)
        line_heights.append(bbox[3] - bbox[1])
    total_h = sum(line_heights) + (len(lines) - 1) * 8
    y = (h - total_h) // 2
    for ln, lh in zip(lines, line_heights):
        bbox = draw.textbbox((0, 0), ln, font=font)
        x = (w - (bbox[2] - bbox[0])) // 2
        draw.text((x, y), ln, font=font, fill=color)
        y += lh + 8

    img.save(out)
    return out


def _make_intro_clip(w, h, duration):
    from moviepy.editor import ColorClip, ImageClip, CompositeVideoClip
    bg = ColorClip(size=(w, h), color=(12, 74, 110)).set_duration(duration)
    title_png = _text_to_png("LUCI", (w, 200), font_size=140, weight="bold")
    sub_png = _text_to_png("Customs Agent — Manual operativo", (w, 80), font_size=36, weight="regular")
    title = ImageClip(str(title_png)).set_duration(duration).set_position(("center", h//2 - 130))
    sub = ImageClip(str(sub_png)).set_duration(duration).set_position(("center", h//2 + 50))
    return CompositeVideoClip([bg, title, sub], size=(w, h)).set_duration(duration)\
        .crossfadein(0.5).crossfadeout(0.4)


def _make_outro_clip(w, h, duration):
    from moviepy.editor import ColorClip, ImageClip, CompositeVideoClip
    bg = ColorClip(size=(w, h), color=(12, 74, 110)).set_duration(duration)
    line1 = _text_to_png("Más información en", (w, 70), font_size=40, weight="regular")
    line2 = _text_to_png("aduanas.strixai.es/wiki", (w, 90), font_size=52, weight="bold")
    c1 = ImageClip(str(line1)).set_duration(duration).set_position(("center", h//2 - 60))
    c2 = ImageClip(str(line2)).set_duration(duration).set_position(("center", h//2 + 10))
    return CompositeVideoClip([bg, c1, c2], size=(w, h)).set_duration(duration)\
        .crossfadein(0.4).crossfadeout(0.4)


def _frames_from_video(video_path: Path, fps: int) -> list[Path]:
    """Extrae frames .png de un .mp4 con ffmpeg. Más robusto que abrir el
    .mp4 con MoviePy directamente (en moviepy 1.x con bucles intensivos
    el reader interno falla intermitentemente con 'failed to read first frame').
    """
    import subprocess
    cache = config.VIDEO_CAPTURES_DIR / f"{video_path.stem}_frames"
    if cache.exists() and any(cache.iterdir()):
        return sorted(cache.glob("frame_*.png"))
    cache.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", str(video_path),
                "-vf", f"fps={fps}",
                str(cache / "frame_%04d.png"),
            ],
            check=True, stderr=subprocess.PIPE, timeout=120,
        )
    except Exception as e:
        print(f"     ⚠️  ffmpeg frames falló: {e}")
        return []
    return sorted(cache.glob("frame_*.png"))


def _make_section_clip(sec, w, h):
    """Construye el clip de una sección.

    Estrategia: extraer frames PNG del .mp4 con ffmpeg y usarlos como
    `ImageSequenceClip`. Es más estable que `VideoFileClip` con MoviePy 1.x
    en bucles largos (el reader FFMPEG interno suele fallar al recorrer
    múltiples archivos seguidos en un solo proceso).

    Sincroniza con la duración del audio:
      - frames > audio: recorta a la duración del audio.
      - frames < audio: replica último frame para alargar.
    """
    from moviepy.editor import (
        AudioFileClip, ImageClip, ImageSequenceClip, CompositeVideoClip, ColorClip,
    )

    audio = None
    audio_dur = 0
    if sec.get("audio") and Path(sec["audio"]).exists():
        audio = AudioFileClip(sec["audio"])
        audio_dur = audio.duration

    duration = max(audio_dur + 0.4, config.MIN_SECTION_DURATION)

    video_path = sec.get("video_capture")
    base_clip = None

    if video_path and Path(video_path).exists():
        frames = _frames_from_video(Path(video_path), config.FPS)
        if frames:
            try:
                # Decidir cuántos frames usar para llenar la duración exacta
                target_frames = int(round(duration * config.FPS))
                src = [str(f) for f in frames]
                if len(src) >= target_frames:
                    src = src[:target_frames]
                else:
                    # Repetir el último para alargar
                    src = src + [src[-1]] * (target_frames - len(src))

                seq = ImageSequenceClip(src, fps=config.FPS)
                # Escalar al viewport (proporción contain)
                if seq.w / seq.h > w / h:
                    seq = seq.resize(width=w)
                else:
                    seq = seq.resize(height=h)
                base_clip = seq.set_position("center").set_duration(duration)
                print(f"   ▶️  {sec['id']}: {len(frames)} frames → {duration:.1f}s a {config.FPS}fps")
            except Exception as e:
                print(f"   ⚠️  {sec['id']}: ImageSequenceClip falló ({e}), usando screenshot")
                base_clip = None
        else:
            print(f"   ⚠️  {sec['id']}: 0 frames extraídos, usando screenshot")

    if base_clip is None:
        img_path = sec.get("screenshot")
        if not img_path or not Path(img_path).exists():
            print(f"   ⚠️  {sec['id']} sin imagen — saltando")
            return None
        img = ImageClip(img_path)
        if img.w / img.h > w / h:
            img = img.resize(width=w)
        else:
            img = img.resize(height=h)
        base_clip = img.set_duration(duration).set_position("center")

    # Banner inferior con título
    banner_h = 80
    banner = ColorClip(size=(w, banner_h), color=(12, 74, 110))\
        .set_opacity(0.85).set_duration(duration).set_position(("center", h - banner_h))

    title_png = _text_to_png(sec["title"], (w - 60, banner_h - 16), font_size=30, weight="bold")
    label = ImageClip(str(title_png)).set_duration(duration)\
        .set_position(("center", h - banner_h + 8))

    bg = ColorClip(size=(w, h), color=(15, 23, 42)).set_duration(duration)
    composite = CompositeVideoClip([bg, base_clip, banner, label], size=(w, h)).set_duration(duration)

    if audio:
        composite = composite.set_audio(audio)

    return composite.crossfadein(config.TRANSITION_FADE).crossfadeout(config.TRANSITION_FADE)


# ============================================================
# CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="LUCI video-wiki pipeline")
    parser.add_argument("--check", action="store_true", help="Verifica config y dependencias")
    parser.add_argument("--extract-only", action="store_true", help="Solo extrae el guion y termina")
    parser.add_argument("--no-capture", action="store_true", help="Salta Playwright, usa solo imágenes wiki/img")
    parser.add_argument("--no-audio", action="store_true", help="Salta ElevenLabs (silent video)")
    parser.add_argument("--refresh-script", action="store_true",
                        help="Ignora output/script.json y re-extrae el guion del wiki (sobrescribe el JSON)")
    args = parser.parse_args()

    errors = config.validate_env()
    if errors:
        print("❌ Configuración inválida:")
        for e in errors:
            print(f"   - {e}")
        if args.check:
            return 1
        if not args.no_audio:
            print("   (usa --no-audio para generar sin voz)")
            return 1

    if args.check:
        print("✅ Config OK.")
        print(f"   PLATFORM_URL = {config.PLATFORM_URL}")
        print(f"   WIKI_DIR = {config.WIKI_DIR}")
        print(f"   ELEVENLABS_VOICE_ID = {config.ELEVENLABS_VOICE_ID}")
        print(f"   Secciones definidas: {len(config.SECTIONS)}")
        return 0

    # 1. extraer guion
    use_saved = not args.refresh_script
    script = extract_script(use_saved=use_saved)

    # Persistir guion (sobreescribe si --refresh-script, mantiene si no)
    if args.refresh_script or not SCRIPT_FILE.exists():
        save_script(script)
        print(f"💾 Guion guardado en {SCRIPT_FILE} (editable)")

    print_script(script)

    if args.extract_only:
        return 0

    # 2. capturas
    script = capture_visuals(script, skip_live=args.no_capture)

    # 3. audio
    if not args.no_audio:
        script = synthesize_audio(script)
    else:
        for s in script:
            s["audio"] = None
        print("🔇 --no-audio: video sin voz.")

    # 4. video
    assemble_video(script)
    return 0


if __name__ == "__main__":
    sys.exit(main())
