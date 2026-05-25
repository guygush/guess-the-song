"""
One-time migration: upload existing local stem MP3s to Cloudflare R2
and update public/data/stems-manifest.json with R2 URLs.

Run from repo root:
  python scripts/migrate_to_r2.py
"""

import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import boto3
from botocore.config import Config

MANIFEST_JSON = os.path.join(os.path.dirname(__file__), "..", "public", "data", "stems-manifest.json")
STEMS_DIR = os.path.join(os.path.dirname(__file__), "output", "htdemucs")

STEM_NAMES = ["bass", "drums", "other", "vocals"]


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


def main():
    cfg = load_r2_config()
    r2 = boto3.client(
        "s3",
        endpoint_url=f"https://{cfg['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=cfg["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=cfg["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )

    with open(MANIFEST_JSON, encoding="utf-8") as f:
        manifest = json.load(f)

    print(f"Migrating {len(manifest)} songs to R2...")
    updated = 0
    skipped = 0
    missing_local = 0

    for entry in manifest:
        track_id = entry["trackId"]
        stem_dir = os.path.join(STEMS_DIR, f"{track_id}_15s")

        # Already migrated (URL starts with R2 public URL)
        if any(v.startswith(cfg["R2_PUBLIC_URL"]) for v in entry["stems"].values()):
            skipped += 1
            continue

        if not os.path.isdir(stem_dir):
            print(f"  MISSING local stems: {entry['performer']} — {entry['song']} (trackId={track_id})")
            missing_local += 1
            continue

        print(f"  Uploading: {entry['performer']} — {entry['song']} ({entry['year']})...", end=" ", flush=True)
        r2_urls = {}
        for stem_name in STEM_NAMES:
            mp3_path = os.path.join(stem_dir, f"{stem_name}.mp3")
            if not os.path.exists(mp3_path):
                raise FileNotFoundError(f"Missing {mp3_path}")
            key = f"stems/{track_id}/{stem_name}.mp3"
            r2.upload_file(mp3_path, cfg["R2_BUCKET_NAME"], key, ExtraArgs={"ContentType": "audio/mpeg"})
            r2_urls[stem_name] = f"{cfg['R2_PUBLIC_URL']}/{key}"

        entry["stems"] = r2_urls
        updated += 1
        print("done")

    with open(MANIFEST_JSON, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"\nDone. Uploaded: {updated}  Already R2: {skipped}  Missing local: {missing_local}")
    if missing_local:
        print("  Songs with missing local stems will need to be re-processed with process_song.py")


if __name__ == "__main__":
    main()
