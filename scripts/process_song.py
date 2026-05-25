"""
Fetch songs from israeli-charts.json, separate into stems with Demucs, encode to MP3,
upload to Vercel Blob, and update public/data/stems-manifest.json.

Usage:
  python scripts/process_song.py                      # 1 song from index 0
  python scripts/process_song.py --index 5            # 1 song from index 5
  python scripts/process_song.py --index 0 --count 4 # 4 songs starting at index 0

Requires BLOB_READ_WRITE_TOKEN env var (or in .env.local at repo root).
Get it from: Vercel dashboard → your project → Storage → Blob → Token.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request

PYTHON_DIR = os.path.dirname(sys.executable)
FFMPEG_BIN = r"C:\ffmpeg-8.1.1-full_build-shared\bin"
FFMPEG = os.path.join(FFMPEG_BIN, "ffmpeg.exe")
DEMUCS = os.path.join(PYTHON_DIR, "Scripts", "demucs.exe")

CHARTS_JSON = os.path.join(os.path.dirname(__file__), "..", "public", "data", "israeli-charts.json")
MANIFEST_JSON = os.path.join(os.path.dirname(__file__), "..", "public", "data", "stems-manifest.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
STEMS_DIR = os.path.join(OUTPUT_DIR, "htdemucs")

ITUNES_SEARCH = "https://itunes.apple.com/search?term={term}&media=music&entity=song&limit=10"
BLOB_UPLOAD_URL = "https://blob.vercel-storage.com/stems/{track_id}/{filename}?access=public&addRandomSuffix=0"


def load_blob_token() -> str:
    token = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
    if not token:
        env_local = os.path.join(os.path.dirname(__file__), "..", ".env.local")
        if os.path.exists(env_local):
            for line in open(env_local).read().splitlines():
                if line.startswith("BLOB_READ_WRITE_TOKEN="):
                    token = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    if not token:
        print("ERROR: BLOB_READ_WRITE_TOKEN not set.")
        print("  Get it from: Vercel dashboard → your project → Storage → Blob → Token")
        print("  Then set it: set BLOB_READ_WRITE_TOKEN=vercel_blob_rw_... (Windows)")
        print("  Or add it to .env.local: BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...")
        sys.exit(1)
    return token


def load_manifest() -> list:
    if not os.path.exists(MANIFEST_JSON):
        return []
    with open(MANIFEST_JSON, encoding="utf-8") as f:
        return json.load(f)


def save_manifest(entries: list) -> None:
    with open(MANIFEST_JSON, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)


def upload_stem(mp3_path: str, track_id: int, filename: str, token: str) -> str:
    url = BLOB_UPLOAD_URL.format(track_id=track_id, filename=filename)
    with open(mp3_path, "rb") as f:
        resp = requests.put(url, data=f, headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "audio/mpeg",
        }, timeout=60)
    resp.raise_for_status()
    return resp.json()["url"]


def check_deps():
    missing = []
    if not os.path.exists(FFMPEG):
        missing.append(f"ffmpeg not found at {FFMPEG_BIN} — install full-shared build from https://www.gyan.dev/ffmpeg/builds/")
    if not os.path.exists(DEMUCS):
        missing.append(f"demucs not found at {DEMUCS}\n  Run: pip install demucs")
    if missing:
        print("Missing dependencies:")
        for m in missing:
            print(f"  - {m}")
        sys.exit(1)


def search_itunes(song, performer):
    term = urllib.parse.quote(f"{performer} {song}")
    url = ITUNES_SEARCH.format(term=term)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read())
    results = [x for x in data.get("results", []) if x.get("previewUrl")]
    return results[0] if results else None


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r, open(dest, "wb") as f:
        f.write(r.read())


def run(cmd, label):
    env = os.environ.copy()
    env["PATH"] = FFMPEG_BIN + os.pathsep + env.get("PATH", "")
    result = subprocess.run(cmd, capture_output=True, env=env)
    if result.returncode != 0:
        raise RuntimeError(f"{label} failed:\n{result.stderr.decode(errors='replace')}")


def already_done(track_id, manifest_ids: set):
    return track_id in manifest_ids


def process(entry, idx, manifest_ids: set, token: str):
    t_start = time.time()
    print(f"\n[{idx}] {entry['performer']} — {entry['song']} ({entry['year']})")
    print("-" * 60)

    # 1. iTunes search
    t0 = time.time()
    print("Searching iTunes...", end=" ", flush=True)
    result = search_itunes(entry["song"], entry["performer"])
    if not result:
        print("SKIP — no iTunes result with previewUrl")
        return None
    track_id = result["trackId"]
    print(f"found trackId={track_id}  ({time.time()-t0:.1f}s)")

    # Already processed?
    if already_done(track_id, manifest_ids):
        print("SKIP — already in manifest")
        return {"skipped": True, "track_id": track_id}

    t_search = time.time() - t0

    # 2. Download preview
    m4a_path = os.path.join(OUTPUT_DIR, f"{track_id}.m4a")
    t0 = time.time()
    print("Downloading preview...", end=" ", flush=True)
    download(result["previewUrl"], m4a_path)
    t_download = time.time() - t0
    print(f"{os.path.getsize(m4a_path)//1024} KB  ({t_download:.1f}s)")

    # 3. Trim to 15s
    wav_path = os.path.join(OUTPUT_DIR, f"{track_id}_15s.wav")
    t0 = time.time()
    print("Trimming to 15s...", end=" ", flush=True)
    run([FFMPEG, "-y", "-i", m4a_path, "-t", "15", "-ar", "44100", wav_path], "ffmpeg trim")
    t_trim = time.time() - t0
    print(f"done  ({t_trim:.1f}s)")
    os.remove(m4a_path)

    # 4. Demucs
    t0 = time.time()
    print("Demucs...", end=" ", flush=True)
    run([DEMUCS, "-n", "htdemucs", "--out", OUTPUT_DIR, wav_path], "demucs")
    t_demucs = time.time() - t0
    print(f"done  ({t_demucs:.1f}s)")
    os.remove(wav_path)

    # 5. Encode stems to MP3 and delete WAVs
    stem_dir = os.path.join(STEMS_DIR, f"{track_id}_15s")
    stem_wavs = [f for f in os.listdir(stem_dir) if f.endswith(".wav")]
    t0 = time.time()
    print("Encoding to MP3 (64kbps)...", end=" ", flush=True)
    for wav_name in stem_wavs:
        wav = os.path.join(stem_dir, wav_name)
        run([FFMPEG, "-y", "-i", wav, "-b:a", "64k", wav.replace(".wav", ".mp3")], f"encode {wav_name}")
        os.remove(wav)
    t_encode = time.time() - t0
    print(f"done  ({t_encode:.1f}s)")

    # 6. Upload to Vercel Blob
    stem_mp3s = sorted(f for f in os.listdir(stem_dir) if f.endswith(".mp3"))
    t0 = time.time()
    print("Uploading to Vercel Blob...", end=" ", flush=True)
    blob_urls: dict = {}
    for mp3_name in stem_mp3s:
        mp3_path = os.path.join(stem_dir, mp3_name)
        stem_key = mp3_name.replace(".mp3", "")  # drums, bass, other, vocals
        blob_urls[stem_key] = upload_stem(mp3_path, track_id, mp3_name, token)
    t_upload = time.time() - t0
    print(f"done  ({t_upload:.1f}s)")

    # 7. Update manifest
    manifest = load_manifest()
    manifest.append({
        "trackId": track_id,
        "song": entry["song"],
        "performer": entry["performer"],
        "year": entry["year"],
        "language": entry["language"],
        "stems": blob_urls,
    })
    save_manifest(manifest)
    manifest_ids.add(track_id)

    total = time.time() - t_start
    sizes = [os.path.getsize(os.path.join(stem_dir, s)) // 1024 for s in stem_mp3s]
    print(f"  stems: {', '.join(f'{s} ({kb}KB)' for s, kb in zip(stem_mp3s, sizes))}")
    print(f"  total: {total:.1f}s")

    return {"track_id": track_id, "total": total, "demucs": t_demucs}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=int, default=0)
    parser.add_argument("--count", type=int, default=1)
    args = parser.parse_args()

    check_deps()
    token = load_blob_token()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(CHARTS_JSON, encoding="utf-8") as f:
        charts = json.load(f)

    manifest_ids = {entry["trackId"] for entry in load_manifest()}

    entries = charts[args.index:args.index + args.count]
    results = []
    t_batch = time.time()

    for i, entry in enumerate(entries):
        try:
            r = process(entry, args.index + i, manifest_ids, token)
            results.append(r)
        except Exception as e:
            print(f"\nERROR: {e}")
            results.append(None)

    if args.count > 1:
        done = [r for r in results if r and not r.get("skipped")]
        skipped = sum(1 for r in results if r and r.get("skipped"))
        failed = sum(1 for r in results if r is None)
        print(f"\n{'='*60}")
        print(f"BATCH SUMMARY  ({args.count} songs)")
        print(f"  Processed: {len(done)}  Skipped: {skipped}  Failed: {failed}")
        if done:
            avg = sum(r["total"] for r in done) / len(done)
            print(f"  Avg time per song: {avg:.1f}s")
        print(f"  Total elapsed: {time.time()-t_batch:.1f}s")


if __name__ == "__main__":
    main()
