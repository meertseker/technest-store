"""Download the allowed models into the image at build time and fail the build
if either is missing. rembg's own `rembg d` swallows download errors (and with
no arguments downloads every model), so we fetch exactly the two allowed MIT
models and check the files ourselves."""

import os
import sys

from rembg.sessions import sessions

ALLOWED_MODELS = ("birefnet-general", "isnet-general-use")

for name in ALLOWED_MODELS:
    path = sessions[name].download_models()
    if not path or not os.path.isfile(path) or os.path.getsize(path) < 1_000_000:
        print(f"model {name} missing after download: {path}", file=sys.stderr)
        sys.exit(1)
    print(f"baked {name}: {path} ({os.path.getsize(path) // (1024 * 1024)} MB)")
