# """
# Cloudflare R2 Service — image upload + presigned URLs.
# R2 is S3-compatible, so we use boto3.
# Free: 10GB storage, 1M PUT/month, 10M GET/month.
# """
# import boto3
# import logging
# from uuid import uuid4
# from typing import Optional
# from app.core.config import settings
# from botocore.config import Config

# logger = logging.getLogger(__name__)

# _r2_client = None

# def get_r2_client():
#     global _r2_client
#     if _r2_client is None and settings.CF_R2_ACCOUNT_ID:
#         _r2_client = boto3.client(
#             "s3",
#             endpoint_url=f"https://{settings.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
#             aws_access_key_id=settings.CF_R2_ACCESS_KEY_ID,
#             aws_secret_access_key=settings.CF_R2_SECRET_ACCESS_KEY,
#             region_name="weur", # ✅ FIX: Better compatibility than 'auto'
#             config=Config(signature_version="s3v4")
#         )
#     return _r2_client

# def generate_upload_url(
#     folder: str,
#     owner_id: str,
#     filename: str,
#     content_type: str = "image/jpeg",
#     expires_in: int = 300,
# ) -> dict:
#     ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
#     key = f"{folder}/{owner_id}/{uuid4()}.{ext}"

#     client = get_r2_client()
#     if not client:
#         fake_public = f"https://picsum.photos/seed/{uuid4()}/800/600"
#         return {"upload_url": None, "public_url": fake_public, "key": key, "dev_mode": True}

#     try:
#         upload_url = client.generate_presigned_url(
#             "put_object",
#             Params={
#                 "Bucket": settings.CF_R2_BUCKET_NAME,
#                 "Key": key,
#                 # ✅ FIX: DO NOT enforce ContentType here. 
#                 # This stops AWS/Cloudflare from rejecting the browser's OPTIONS preflight request!
#             },
#             ExpiresIn=expires_in,
#         )
#         public_url = f"{settings.CF_R2_PUBLIC_URL}/{key}"
#         return {"upload_url": upload_url, "public_url": public_url, "key": key}
#     except Exception as e:
#         logger.error(f"R2 presign error: {e}")
#         raise

# def delete_object(key: str) -> bool:
#     """Delete an object from R2."""
#     client = get_r2_client()
#     if not client:
#         return True
#     try:
#         client.delete_object(Bucket=settings.CF_R2_BUCKET_NAME, Key=key)
#         return True
#     except Exception as e:
#         logger.error(f"R2 delete error: {e}")
#         return False

"""
r2_service.py — R2 REMOVED

Cloudflare R2 has been replaced with base64 storage.
Photos and audio are now stored as data URIs directly in the database.

This file exists only to prevent ImportError if anything still imports it.
All actual upload logic is in app/api/upload.py.
"""


def get_r2_client():
    """R2 removed. Returns None — callers should handle gracefully."""
    return None


def generate_upload_url(folder: str, owner_id: str, filename: str,
                        content_type: str = "image/jpeg", expires_in: int = 300) -> dict:
    """
    R2 presigned URLs removed.
    Returns a dev-mode response so old code doesn't crash hard.
    Frontend should be updated to POST to /api/upload/photo instead.
    """
    return {
        "upload_url": None,
        "public_url": None,
        "key": f"{folder}/{owner_id}/{filename}",
        "dev_mode": True,
        "error": "R2 removed. Use POST /api/upload/photo (multipart/form-data).",
    }


def delete_object(key: str) -> bool:
    """No-op. R2 removed."""
    return True