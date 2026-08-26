import os
import sys
import json
import asyncio
import requests
import subprocess
import edge_tts
from google import genai
from google.genai import types

# Forza output UTF-8 su console Windows per evitare crash di codifica charmap
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PEXELS_API_KEY = "j3aUrt9xXGltOGuhVPJzhTqZoKRYGQuHJddXlMRMgTne3IchjYoRyzCQ"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OUTPUT_DIR = os.path.join(os.getcwd(), "output_renders")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Inizializza client GenAI per Imagen 3
ai_client = None
if GEMINI_API_KEY:
    try:
        ai_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"[Avviso] Inizializzazione Gemini Client fallita: {e}")

TECH_FALLBACK_QUERIES = [
    "smartphone technology device",
    "futuristic digital electronics",
    "computer processor microchip",
    "minimal tech workspace setup",
    "apple mobile ecosystem"
]

def sanitize_tech_query(query: str) -> str:
    """Rimuove ambiguità ed evita frutti o contenuti non tecnologici"""
    q = query.lower().strip()
    if "apple" in q and not any(k in q for k in ["iphone", "tech", "device", "gadget", "macbook"]):
        return f"{q} iphone smartphone technology"
    return f"{q} technology device"

async def generate_voiceover(text: str, audio_path: str):
    """Genera traccia vocale pulita in italiano con Edge-TTS (senza sottotitoli a schermo)"""
    communicate = edge_tts.Communicate(text, "it-IT-DiegoNeural", rate="+0%")
    with open(audio_path, "wb") as file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                file.write(chunk["data"])

def query_pexels(query: str) -> list:
    """Interroga Pexels per video verticali in formato ritratto (9:16)"""
    headers = {"Authorization": PEXELS_API_KEY}
    url = f"https://api.pexels.com/videos/search?query={requests.utils.quote(query)}&orientation=portrait&per_page=4"
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            return res.json().get("videos", [])
    except Exception as e:
        print(f"[Avviso] Errore Pexels per '{query}': {e}")
    return []

def generate_ai_image(prompt: str, output_path: str) -> bool:
    """Genera un'immagine AI fotorealistica 9:16 con Imagen 3 per scene storiche o concettuali"""
    if not ai_client:
        return False
    
    clean_prompt = f"Cinematic vertical shot 9:16, high-end commercial tech aesthetic, realistic lighting: {prompt}"
    print(f"[Imagen 3] Generazione visual AI: '{prompt}'...")
    try:
        result = ai_client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=clean_prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="9:16",
                output_mime_type="image/jpeg",
            ),
        )
        for generated_image in result.generated_images:
            with open(output_path, "wb") as f:
                f.write(generated_image.image.image_bytes)
            return True
    except Exception as e:
        print(f"[Avviso] Fallita generazione Imagen 3: {e}")
    return False

def download_or_generate_beat_asset(beat_idx: int, beat: dict, cache_dir: str) -> tuple[str, str]:
    """Cerca prima un video Pexels super attinente; se non lo trova, genera un'immagine AI 9:16 con Imagen 3"""
    search_term = sanitize_tech_query(beat.get("visualSearchTerm") or beat.get("visual") or "technology device")
    videos = query_pexels(search_term)
    
    # 1. Prova video stock verticale da Pexels
    for video in videos:
        files = video.get("video_files", [])
        hd_file = next((f for f in files if f.get("width") == 1080 and f.get("height") == 1920), None)
        if not hd_file:
            hd_file = next((f for f in files if f.get("width") == 720 and f.get("height") == 1280), None)
        if not hd_file and files:
            hd_file = files[0]

        if hd_file:
            video_url = hd_file.get("link")
            raw_video_path = os.path.join(cache_dir, f"beat_{beat_idx + 1}_video.mp4")
            try:
                print(f"[Asset Beat #{beat_idx+1}] Scaricamento video stock per '{search_term}'...")
                with requests.get(video_url, stream=True, timeout=25) as r:
                    r.raise_for_status()
                    with open(raw_video_path, "wb") as f:
                        for chunk in r.iter_content(chunk_size=16384):
                            f.write(chunk)
                return ("video", raw_video_path)
            except Exception:
                continue

    # 2. Fallback su Generazione Immagine AI (Imagen 3)
    img_path = os.path.join(cache_dir, f"beat_{beat_idx + 1}_image.jpg")
    ai_prompt = beat.get("visual") or search_term
    if generate_ai_image(ai_prompt, img_path):
        return ("image", img_path)

    # 3. Fallback finale su video tech generico
    fallback_path = os.path.join(cache_dir, f"beat_{beat_idx + 1}_fallback.mp4")
    f_videos = query_pexels("smartphone tech device")
    for v in f_videos:
        files = v.get("video_files", [])
        if files:
            with requests.get(files[0]["link"], stream=True, timeout=20) as r:
                with open(fallback_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=16384):
                        f.write(chunk)
            return ("video", fallback_path)

    return ("none", "")

def process_and_animate_beat(asset_type: str, asset_path: str, output_clip: str, duration: float, zoom_type: str, card_title: str):
    """Applica Ken Burns Motion, zoom dinamico e Motion Graphic Card (senza sottotitoli)"""
    dur_frames = max(30, int(duration * 30))
    clean_card_text = card_title.replace("'", "").replace(":", "-")[:35].upper() if card_title else ""

    # Box grafico tech in sovrimpressione in alto
    title_box = ""
    if clean_card_text:
        title_box = f",drawbox=x=60:y=180:w=960:h=90:color=black@0.65:t=fill,drawtext=text='{clean_card_text}':fontcolor=white:fontsize=32:x=90:y=210:box=0"

    if asset_type == "image":
        # Movimento Ken Burns fluido su immagine AI (9:16)
        if zoom_type == "push_in":
            vf = f"zoompan=z='min(zoom+0.0018,1.25)':d={dur_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30{title_box}"
        else:
            vf = f"zoompan=z='min(zoom+0.0010,1.15)':d={dur_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30{title_box}"
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", asset_path,
            "-t", str(duration),
            "-vf", vf,
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-r", "30",
            output_clip
        ]
    else:
        # Taglio e Zoom su video stock (9:16)
        if zoom_type in ["1.2x", "punch"]:
            vf = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,scale=1.2*in_w:-1,crop=1080:1920,fps=30{title_box}"
        elif zoom_type == "push_in":
            vf = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0015,1.20)':d={dur_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30{title_box}"
        else:
            vf = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30{title_box}"

        cmd = [
            "ffmpeg", "-y",
            "-ss", "0", "-i", asset_path,
            "-t", str(duration),
            "-vf", vf,
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-r", "30", "-an",
            output_clip
        ]

    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def assemble_final_video(processed_clips: list, audio_path: str, output_path: str, task_dir: str):
    """Unisce tutte le scene animate e sincronizza la traccia audio principale"""
    concat_list_path = os.path.join(task_dir, "concat_beats.txt")
    with open(concat_list_path, "w", encoding="utf-8") as f:
        for clip in processed_clips:
            clean_path = clip.replace("\\", "/")
            f.write(f"file '{clean_path}'\n")

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0", "-i", concat_list_path,
        "-i", audio_path,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        output_path
    ]
    print("[Render] Montaggio finale e sincronizzazione audio...")
    subprocess.run(cmd, check=True)
    print(f"[Completato] Video finale esportato con successo in: {output_path}")

async def main():
    raw_input = ""
    if not sys.stdin.isatty():
        raw_input = sys.stdin.read()
    elif len(sys.argv) > 1:
        raw_input = sys.argv[1]

    if not raw_input.strip():
        print("Errore: nessun payload ricevuto.")
        sys.exit(1)

    payload = json.loads(raw_input)
    script_text = payload.get("script", "")
    beats = payload.get("beats", [])
    total_duration = float(payload.get("duration", 30))

    if not beats:
        num_beats = max(3, int(total_duration / 4.0))
        beat_dur = total_duration / num_beats
        beats = [{"durationSec": beat_dur, "type": "beat", "visual": "modern technology"} for _ in range(num_beats)]

    task_id = payload.get("id", f"render_{os.urandom(4).hex()}")
    task_dir = os.path.join(OUTPUT_DIR, task_id)
    os.makedirs(task_dir, exist_ok=True)

    audio_file = os.path.join(task_dir, "voiceover.mp3")
    final_output = os.path.join(task_dir, "final_video.mp4")

    print(f"[Task {task_id}] Avvio generazione video multi-scena ({len(beats)} beats)...")
    print("1/4 Sintesi vocale italiana in corso...")
    await generate_voiceover(script_text, audio_file)

    print("2/4 Recupero e generazione asset visivi mirati per ciascun Beat...")
    beat_assets = []
    for idx, beat in enumerate(beats):
        asset_type, path = download_or_generate_beat_asset(idx, beat, task_dir)
        beat_assets.append((asset_type, path))

    print("3/4 Rendering transizioni, Ken Burns e Motion Cards...")
    processed_clips = []
    for idx, ((asset_type, path), beat) in enumerate(zip(beat_assets, beats)):
        dur = float(beat.get("durationSec") or beat.get("duration") or 3.5)
        zoom = "1.2x" if idx % 3 == 1 else "push_in" if idx % 3 == 2 else "1.0x"
        card_label = beat.get("overlayText") or beat.get("type") or ""
        out_clip = os.path.join(task_dir, f"scene_{idx + 1}.mp4")
        
        print(f"  -> Scena #{idx+1} ({dur:.1f}s) | Tipo: {asset_type} | Card: '{card_label}'")
        process_and_animate_beat(asset_type, path, out_clip, dur, zoom, card_label)
        processed_clips.append(out_clip)

    print("4/4 Assemblaggio finale del video MP4 in 9:16...")
    assemble_final_video(processed_clips, audio_file, final_output, task_dir)

if __name__ == "__main__":
    asyncio.run(main())