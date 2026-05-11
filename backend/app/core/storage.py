"""
File storage abstraction.

- When SUPABASE_URL and SUPABASE_KEY are set: uploads to Supabase Storage and
  returns a public CDN URL. This is the production path (Railway).
- Otherwise: saves to the local STATIC_DIR and returns a /static/... URL.
  This is the development fallback (SQLite + local disk).

Bucket → local folder mapping (hyphens replaced with underscores):
  slips       → static/slips/
  mockups     → static/mockups/
  artworks    → static/artworks/
  print-files → static/print_files/
"""

import logging
import os

import requests as http_requests

from app.core.config import settings

logger = logging.getLogger(__name__)


def save_upload(data: bytes, bucket: str, filename: str, content_type: str) -> str:
    """Persist *data* and return a URL the client can fetch later."""
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        return _upload_to_supabase(data, bucket, filename, content_type)
    return _save_to_disk(data, bucket, filename)


def _upload_to_supabase(
    data: bytes, bucket: str, filename: str, content_type: str
) -> str:
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{filename}"
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    resp = http_requests.put(url, data=data, headers=headers, timeout=30)
    resp.raise_for_status()
    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{filename}"


def _save_to_disk(data: bytes, bucket: str, filename: str) -> str:
    local_folder = bucket.replace("-", "_")
    folder = os.path.join(settings.STATIC_DIR, local_folder)
    os.makedirs(folder, exist_ok=True)
    dest = os.path.join(folder, filename)
    with open(dest, "wb") as f:
        f.write(data)
    return f"/static/{local_folder}/{filename}"


def detect_image_type(data: bytes) -> str | None:
    """Return 'jpeg', 'png', or None — without using the deprecated imghdr module."""
    if data[:2] == b"\xff\xd8":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    return None
