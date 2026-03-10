"""Cloudflare R2 presigned URL generation."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.r2_service import generate_upload_url
from app.middleware.auth_middleware import require_any
import boto3
from botocore.config import Config
from uuid import uuid4
from fastapi import UploadFile, File
from app.core.config import settings


router = APIRouter(tags=["upload"])


class PresignRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"
    folder: str = "complaints"  # complaints / profiles / disputes


@router.post("/presign")
async def presign_upload(body: PresignRequest, payload=Depends(require_any)):
    """
    Get a presigned URL for direct browser → R2 upload.
    Frontend uploads directly. Backend never sees binary.
    """
    allowed_folders = {"complaints", "profiles", "disputes"}
    if body.folder not in allowed_folders:
        raise HTTPException(400, "Invalid folder")

    owner_id = payload.get("sub", "unknown")
    result = generate_upload_url(
        folder=body.folder,
        owner_id=owner_id,
        filename=body.filename,
        content_type=body.content_type,
    )
    return result

@router.post("/audio")
async def upload_audio(
    file: UploadFile = File(...),
    payload=Depends(require_any),
):
    owner_id = payload.get("sub", "unknown")
    key = f"complaints/{owner_id}/{uuid4()}.webm"
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(400, "Empty audio file")
    try:
        client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.CF_R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.CF_R2_SECRET_ACCESS_KEY,
            region_name="weur",
            config=Config(signature_version="s3v4"),
        )
        client.put_object(
            Bucket=settings.CF_R2_BUCKET_NAME,
            Key=key,
            Body=audio_bytes,
            ContentType="audio/webm",
        )
        return {"public_url": f"{settings.CF_R2_PUBLIC_URL}/{key}", "key": key}
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"R2 audio upload failed: {e}")
        if settings.APP_ENV == "development":
            return {"public_url": f"{settings.CF_R2_PUBLIC_URL}/{key}", "key": key, "dev_mode": True}
        raise HTTPException(500, f"Audio upload failed: {e}")