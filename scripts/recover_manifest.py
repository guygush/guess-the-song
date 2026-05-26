"""
Recover manifest entries from batch_run.log.
Parses the log to find (index, trackId) for all successfully uploaded songs,
cross-references charts.json for metadata, and adds missing entries to manifest.
"""
import json
import os
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(__file__)
LOG_PATH = os.path.join(SCRIPT_DIR, "output", "batch_run_all.log")
CHARTS_JSON = os.path.join(SCRIPT_DIR, "..", "public", "data", "israeli-charts.json")
MANIFEST_JSON = os.path.join(SCRIPT_DIR, "..", "public", "data", "stems-manifest.json")
R2_PUBLIC_URL = "https://pub-d345c31261e54db893c1b5945406568f.r2.dev"
STEM_NAMES = ["bass", "drums", "other", "vocals"]


def load_manifest_safe():
    """Load manifest, handling JSON corruption by truncating at the last valid entry."""
    if not os.path.exists(MANIFEST_JSON):
        return []
    raw = open(MANIFEST_JSON, encoding="utf-8").read()
    # Try full parse first
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Truncate at last valid closing bracket sequence
    # Find the last occurrence of '}' followed by optional whitespace then ']'
    last_valid = raw.rfind("\n  }\n]")
    if last_valid != -1:
        truncated = raw[:last_valid + 5] + "\n]"
        try:
            data = json.loads(truncated)
            print(f"  Recovered {len(data)} entries from corrupted manifest (truncated at char {last_valid})")
            return data
        except json.JSONDecodeError as e:
            print(f"  Truncation recovery failed: {e}")
    # Try finding last complete entry a different way
    idx = len(raw)
    while idx > 0:
        idx = raw.rfind("  },", 0, idx)
        if idx == -1:
            break
        candidate = raw[:idx + 3] + "\n]"
        try:
            data = json.loads(candidate)
            print(f"  Recovered {len(data)} entries (fallback truncation at {idx})")
            return data
        except json.JSONDecodeError:
            continue
    print("  WARNING: could not recover manifest, starting fresh")
    return []


def parse_log(log_path):
    """Return dict of {index: trackId} for all entries where upload succeeded."""
    results = {}
    current_idx = None
    current_track_id = None
    uploaded = False

    with open(log_path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip()
            # Match "[2624] Some Song" — entry start
            m = re.match(r"^\[(\d+)\]", line)
            if m:
                current_idx = int(m.group(1))
                current_track_id = None
                uploaded = False
                continue
            # Match "found trackId=1572558234"
            m = re.search(r"found trackId=(\d+)", line)
            if m and current_idx is not None:
                current_track_id = int(m.group(1))
                continue
            # Match successful upload
            if "Uploading to R2... done" in line and current_idx is not None and current_track_id is not None:
                results[current_idx] = current_track_id
                continue

    return results


def main():
    print("Loading charts.json...")
    with open(CHARTS_JSON, encoding="utf-8") as f:
        charts = json.load(f)

    print("Loading manifest (with corruption recovery)...")
    manifest = load_manifest_safe()
    manifest_track_ids = {entry["trackId"] for entry in manifest}
    print(f"  Manifest has {len(manifest)} entries, {len(manifest_track_ids)} unique trackIds")

    print("Parsing log...")
    log_uploads = parse_log(LOG_PATH)
    print(f"  Found {len(log_uploads)} successful uploads in log")

    # Find uploads missing from manifest
    missing = {idx: tid for idx, tid in log_uploads.items() if tid not in manifest_track_ids}
    print(f"  Missing from manifest: {len(missing)} entries")

    if not missing:
        print("Nothing to recover.")
    else:
        added = 0
        for idx, track_id in sorted(missing.items()):
            if idx >= len(charts):
                print(f"  WARN: index {idx} out of range")
                continue
            entry = charts[idx]
            manifest.append({
                "trackId": track_id,
                "song": entry["song"],
                "performer": entry["performer"],
                "year": entry["year"],
                "language": entry["language"],
                "stems": {stem: f"{R2_PUBLIC_URL}/stems/{track_id}/{stem}.mp3" for stem in STEM_NAMES},
            })
            added += 1

        print(f"  Adding {added} entries to manifest...")
        with open(MANIFEST_JSON, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        print(f"  Manifest saved: {len(manifest)} total entries")

    # Summary
    print(f"\nFinal manifest size: {len(manifest)} songs")


if __name__ == "__main__":
    main()
