"""Tests for server.py with rembg stubbed out (no models, no onnxruntime needed).

Run: pip install fastapi==0.128.0 python-multipart==0.0.21 "pillow>=12.1,<13" httpx
     python -m unittest infra/photo-worker/test_server.py
"""

import io
import os
import sys
import types
import unittest

from PIL import Image

os.environ["PHOTO_WORKER_MAX_UPLOAD_BYTES"] = str(2 * 1024 * 1024)
os.environ["PHOTO_WORKER_MAX_PIXELS"] = str(4000 * 3000)
os.environ["PHOTO_WORKER_MAX_SIDE"] = "1024"

# Stub rembg: records which models were loaded; "removes" nothing, just adds alpha.
loaded: list = []
rembg = types.ModuleType("rembg")


def _new_session(model_name, *args, **kwargs):
    loaded.append(model_name)
    return types.SimpleNamespace(name=model_name)


def _remove(img, session=None, **kwargs):
    assert session is not None, "remove() must always get an explicit session"
    return img.convert("RGBA")


rembg.new_session = _new_session
rembg.remove = _remove
sys.modules["rembg"] = rembg
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402


def image_bytes(fmt="JPEG", size=(1600, 1200)):
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 30, 40)).save(buf, format=fmt)
    return buf.getvalue()


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(server.app)
        cls.client.__enter__()  # runs the lifespan (loads the default model)

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def post(self, data, model=None, name="p.jpg"):
        fields = {"model": model} if model else {}
        return self.client.post("/remove", files={"file": (name, data, "image/jpeg")}, data=fields)

    def test_health(self):
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["default_model"], "birefnet-general")
        self.assertEqual(r.json()["models"], ["birefnet-general", "isnet-general-use"])

    def test_remove_returns_rgba_png_downscaled_same_aspect(self):
        r = self.post(image_bytes())
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["content-type"], "image/png")
        self.assertEqual(r.headers["x-model"], "birefnet-general")
        out = Image.open(io.BytesIO(r.content))
        self.assertEqual(out.mode, "RGBA")
        self.assertEqual(out.size, (1024, 768))

    def test_png_and_webp_accepted(self):
        for fmt in ("PNG", "WEBP"):
            self.assertEqual(self.post(image_bytes(fmt, (800, 600))).status_code, 200, fmt)

    def test_rejects_models_outside_the_allow_list(self):
        before = list(loaded)
        for model in ("u2net", "birefnet-general-lite", "../x"):
            r = self.post(image_bytes(), model=model)
            self.assertEqual(r.status_code, 400, model)
        self.assertEqual(loaded, before)

    def test_switching_model_keeps_only_one_loaded(self):
        self.assertEqual(self.post(image_bytes(), model="isnet-general-use").status_code, 200)
        self.assertEqual(list(server._sessions), ["isnet-general-use"])
        self.assertEqual(self.post(image_bytes(), model="birefnet-general").status_code, 200)
        self.assertEqual(list(server._sessions), ["birefnet-general"])

    def test_rejects_unsupported_or_unreadable_images(self):
        self.assertEqual(self.post(image_bytes("GIF", (100, 100))).status_code, 400)
        self.assertEqual(self.post(b"hello, not an image").status_code, 400)
        self.assertEqual(self.post(b"").status_code, 400)
        # A URL is just bytes to us: never fetched.
        self.assertEqual(self.post(b"http://169.254.169.254/latest/meta-data/").status_code, 400)

    def test_rejects_too_many_pixels(self):
        buf = io.BytesIO()
        Image.new("L", (5000, 3000)).save(buf, format="PNG")  # compresses to a few KB
        r = self.post(buf.getvalue(), name="bomb.png")
        self.assertEqual(r.status_code, 400)

    def test_rejects_large_bodies_by_content_length(self):
        r = self.post(b"\xff" * (3 * 1024 * 1024))
        self.assertEqual(r.status_code, 413)

    def test_rejects_large_chunked_bodies(self):
        boundary = "b0undary"
        head = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"p.jpg\"\r\n"
                "Content-Type: image/jpeg\r\n\r\n").encode()

        def body():
            yield head
            for _ in range(48):
                yield b"\xff" * 65536
            yield f"\r\n--{boundary}--\r\n".encode()

        r = self.client.post("/remove", content=body(),
                             headers={"content-type": f"multipart/form-data; boundary={boundary}"})
        self.assertEqual(r.status_code, 413)

    def test_no_other_routes(self):
        for path in ("/api", "/docs", "/openapi.json", "/api/remove"):
            self.assertEqual(self.client.get(path).status_code, 404, path)


if __name__ == "__main__":
    unittest.main()
