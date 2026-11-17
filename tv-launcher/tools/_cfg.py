"""Tiny helper: merge keys into tools/config.json (creating it from the example if needed)."""
import json, pathlib, shutil, sys
here = pathlib.Path(__file__).parent
cfg = here / "config.json"
if not cfg.exists():
    shutil.copy(here / "config.example.json", cfg)
data = json.loads(cfg.read_text())
section, pairs = sys.argv[1], sys.argv[2:]
for p in pairs:
    k, v = p.split("=", 1)
    data.setdefault(section, {})[k] = v
cfg.write_text(json.dumps(data, indent=2, ensure_ascii=False))
print("saved to tools/config.json:", ", ".join(p.split("=", 1)[0] for p in pairs))
