"""
Fetch songs from israeli-charts.json, separate into stems with Demucs, encode to MP3,
upload to Cloudflare R2, and update public/data/stems-manifest.json.

Usage:
  python scripts/process_song.py                      # 1 song from index 0
  python scripts/process_song.py --index 5            # 1 song from index 5
  python scripts/process_song.py --index 0 --count 4 # 4 songs starting at index 0

Requires R2 credentials in .env.local:
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
"""

import argparse
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.parse
import urllib.request

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import boto3
import urllib3
from botocore.config import Config

# Python 3.14 raised minimum SSL key strength — some endpoints (R2, iTunes) use
# certs that fail the new default. Lower to SECLEVEL=1 for outbound script calls.
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.set_ciphers("DEFAULT@SECLEVEL=1")

PYTHON_DIR = os.path.dirname(sys.executable)
FFMPEG_BIN = r"C:\ffmpeg-8.1.1-full_build-shared\bin"
FFMPEG = os.path.join(FFMPEG_BIN, "ffmpeg.exe")
DEMUCS = os.path.join(PYTHON_DIR, "Scripts", "demucs.exe")

CHARTS_JSON = os.path.join(os.path.dirname(__file__), "..", "public", "data", "israeli-charts.json")
MANIFEST_JSON = os.path.join(os.path.dirname(__file__), "..", "public", "data", "stems-manifest.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
STEMS_DIR = os.path.join(OUTPUT_DIR, "htdemucs")

ITUNES_SEARCH = "https://itunes.apple.com/search?term={term}&media=music&entity=song&limit=10"


def load_env_local() -> dict:
    env_local = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    result = {}
    if os.path.exists(env_local):
        for line in open(env_local).read().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                result[k.strip()] = v.strip().strip('"').strip("'")
    return result


def load_r2_config():
    env = load_env_local()
    keys = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]
    cfg = {k: os.environ.get(k, env.get(k, "")) for k in keys}
    missing = [k for k, v in cfg.items() if not v]
    if missing:
        print(f"ERROR: Missing R2 config: {', '.join(missing)}")
        sys.exit(1)
    return cfg


def make_r2_client(cfg):
    return boto3.client(
        "s3",
        endpoint_url=f"https://{cfg['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=cfg["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=cfg["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto",
        verify=False,
    )


def upload_stem(r2, bucket: str, public_url: str, mp3_path: str, track_id: int, stem_name: str) -> str:
    key = f"stems/{track_id}/{stem_name}.mp3"
    r2.upload_file(mp3_path, bucket, key, ExtraArgs={"ContentType": "audio/mpeg"})
    return f"{public_url}/{key}"


def load_manifest() -> list:
    if not os.path.exists(MANIFEST_JSON):
        return []
    with open(MANIFEST_JSON, encoding="utf-8") as f:
        return json.load(f)


def save_manifest(entries: list) -> None:
    tmp = MANIFEST_JSON + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    os.replace(tmp, MANIFEST_JSON)  # atomic on same filesystem


def check_deps():
    missing = []
    if not os.path.exists(FFMPEG):
        missing.append(f"ffmpeg not found at {FFMPEG_BIN}")
    if not os.path.exists(DEMUCS):
        missing.append(f"demucs not found at {DEMUCS} — run: pip install demucs")
    if missing:
        print("Missing dependencies:")
        for m in missing:
            print(f"  - {m}")
        sys.exit(1)


def search_itunes(song, performer):
    term = urllib.parse.quote(f"{performer} {song}")
    url = ITUNES_SEARCH.format(term=term)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx) as r:
        data = json.loads(r.read())
    results = [x for x in data.get("results", []) if x.get("previewUrl")]
    return results[0] if results else None


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30, context=_ssl_ctx) as r, open(dest, "wb") as f:
        f.write(r.read())


def run(cmd, label):
    env = os.environ.copy()
    env["PATH"] = FFMPEG_BIN + os.pathsep + env.get("PATH", "")
    result = subprocess.run(cmd, capture_output=True, env=env)
    if result.returncode != 0:
        raise RuntimeError(f"{label} failed:\n{result.stderr.decode(errors='replace')}")


def process(entry, idx, manifest_ids: set, r2, cfg):
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

    if track_id in manifest_ids:
        print("SKIP — already in manifest")
        return {"skipped": True, "track_id": track_id}

    # 2. Download preview
    m4a_path = os.path.join(OUTPUT_DIR, f"{track_id}.m4a")
    t0 = time.time()
    print("Downloading preview...", end=" ", flush=True)
    download(result["previewUrl"], m4a_path)
    print(f"{os.path.getsize(m4a_path)//1024} KB  ({time.time()-t0:.1f}s)")

    # 3. Trim to 30s
    wav_path = os.path.join(OUTPUT_DIR, f"{track_id}.wav")
    t0 = time.time()
    print("Trimming to 30s...", end=" ", flush=True)
    run([FFMPEG, "-y", "-i", m4a_path, "-t", "30", "-ar", "44100", wav_path], "ffmpeg trim")
    print(f"done  ({time.time()-t0:.1f}s)")
    os.remove(m4a_path)

    # 4. Demucs
    t0 = time.time()
    print("Demucs...", end=" ", flush=True)
    run([DEMUCS, "-n", "htdemucs", "--out", OUTPUT_DIR, wav_path], "demucs")
    t_demucs = time.time() - t0
    print(f"done  ({t_demucs:.1f}s)")
    os.remove(wav_path)

    # 5. Encode stems to MP3
    stem_dir = os.path.join(STEMS_DIR, f"{track_id}")
    stem_wavs = [f for f in os.listdir(stem_dir) if f.endswith(".wav")]
    t0 = time.time()
    print("Encoding to MP3 (64kbps)...", end=" ", flush=True)
    for wav_name in stem_wavs:
        wav = os.path.join(stem_dir, wav_name)
        run([FFMPEG, "-y", "-i", wav, "-b:a", "64k", wav.replace(".wav", ".mp3")], f"encode {wav_name}")
        os.remove(wav)
    print(f"done  ({time.time()-t0:.1f}s)")

    # 6. Upload to R2
    stem_mp3s = sorted(f for f in os.listdir(stem_dir) if f.endswith(".mp3"))
    t0 = time.time()
    print("Uploading to R2...", end=" ", flush=True)
    r2_urls: dict = {}
    for mp3_name in stem_mp3s:
        stem_name = mp3_name.replace(".mp3", "")
        r2_urls[stem_name] = upload_stem(r2, cfg["R2_BUCKET_NAME"], cfg["R2_PUBLIC_URL"],
                                          os.path.join(stem_dir, mp3_name), track_id, stem_name)
    print(f"done  ({time.time()-t0:.1f}s)")

    # 7. Update manifest
    manifest = load_manifest()
    manifest.append({
        "trackId": track_id,
        "song": entry["song"],
        "performer": entry["performer"],
        "year": entry["year"],
        "language": entry["language"],
        "stems": r2_urls,
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
    cfg = load_r2_config()
    r2 = make_r2_client(cfg)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(CHARTS_JSON, encoding="utf-8") as f:
        charts = json.load(f)

    manifest_ids = {entry["trackId"] for entry in load_manifest()}

    entries = charts[args.index:args.index + args.count]
    results = []
    t_batch = time.time()

    for i, entry in enumerate(entries):
        if entry.get("position", 1) > 5:
            print(f"[{args.index + i}] SKIP (position {entry.get('position')}) — {entry['performer']} — {entry['song']}")
            results.append({"skipped": True, "track_id": None})
            continue
        try:
            r = process(entry, args.index + i, manifest_ids, r2, cfg)
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
