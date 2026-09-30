"""Download the allowed models into the image at build time and fail the build
if either is missing or if anything else ends up in the model directory.
rembg's own `rembg d` swallows download errors (and with no arguments downloads
every model, including the non-commercial default), so we fetch exactly the two
allowed MIT models and check the files ourselves."""

import os
import sys

from rembg.sessions import sessions

ALLOWED_MODELS = ("birefnet-general", "isnet-general-use")

baked = set()
for name in ALLOWED_MODELS:
    path = sessions[name].download_models()
    if not path or not os.path.isfile(path) or os.path.getsize(path) < 1_000_000:
        print(f"model {name} missing after download: {path}", file=sys.stderr)
        sys.exit(1)
    baked.add(os.path.realpath(path))
    print(f"baked {name}: {path} ({os.path.getsize(path) // (1024 * 1024)} MB)")

# Every file under the model home must be one of the two we just baked.
home = os.path.realpath(sessions[ALLOWED_MODELS[0]].rembg_home())
extra = [
    os.path.join(root, f)
    for root, _dirs, files in os.walk(home)
    for f in files
    if os.path.realpath(os.path.join(root, f)) not in baked
]
if extra:
    print(f"unexpected files in {home}: {extra}", file=sys.stderr)
    sys.exit(1)
print(f"{home} holds only: {', '.join(ALLOWED_MODELS)}")
