"""Cloudflare R2 presigned URL generation."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.r2_service import generate_upload_url
from app.middleware.auth_middleware import require_any

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