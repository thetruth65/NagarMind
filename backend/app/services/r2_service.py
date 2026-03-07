"""
Cloudflare R2 Service — image upload + presigned URLs.
R2 is S3-compatible, so we use boto3.
Free: 10GB storage, 1M PUT/month, 10M GET/month.
"""
import boto3
import logging
from uuid import uuid4
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

_r2_client = None


def get_r2_client():
    global _r2_client
    if _r2_client is None and settings.CF_R2_ACCOUNT_ID:
        _r2_client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.CF_R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.CF_R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )
    return _r2_client


def generate_upload_url(
    folder: str,
    owner_id: str,
    filename: str,
    content_type: str = "image/jpeg",
    expires_in: int = 300,
) -> dict:
    """
    Generate a presigned PUT URL for direct browser → R2 upload.
    Backend never receives the binary file.
    Returns: {upload_url, public_url, key}
    """
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
    key = f"{folder}/{owner_id}/{uuid4()}.{ext}"

    client = get_r2_client()
    if not client:
        # Dev mode — return a fake URL
        fake_public = f"https://picsum.photos/seed/{uuid4()}/800/600"
        return {"upload_url": None, "public_url": fake_public, "key": key, "dev_mode": True}

    try:
        upload_url = client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.CF_R2_BUCKET_NAME,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )
        public_url = f"{settings.CF_R2_PUBLIC_URL}/{key}"
        return {"upload_url": upload_url, "public_url": public_url, "key": key}
    except Exception as e:
        logger.error(f"R2 presign error: {e}")
        raise


def delete_object(key: str) -> bool:
    """Delete an object from R2."""
    client = get_r2_client()
    if not client:
        return True
    try:
        client.delete_object(Bucket=settings.CF_R2_BUCKET_NAME, Key=key)
        return True
    except Exception as e:
        logger.error(f"R2 delete error: {e}")
        return False