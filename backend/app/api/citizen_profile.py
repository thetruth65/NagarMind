"""Citizen profile management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.middleware.auth_middleware import require_citizen

router = APIRouter(tags=["citizen"])


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    home_address: Optional[str] = None
    preferred_language: Optional[str] = None
    profile_photo_url: Optional[str] = None


@router.get("/profile")
async def get_profile(payload=Depends(require_citizen), pool=Depends(get_db)):
    row = await pool.fetchrow(
        """SELECT c.*, w.ward_name, w.zone, w.health_score, w.health_grade,
                  (SELECT COUNT(*) FROM complaints WHERE citizen_id=c.citizen_id) AS total_complaints,
                  (SELECT COUNT(*) FROM complaints WHERE citizen_id=c.citizen_id
                   AND status IN ('resolved','closed')) AS resolved_count,
                  (SELECT COUNT(*) FROM complaints WHERE citizen_id=c.citizen_id
                   AND disputed=TRUE) AS disputes_raised,
                  (SELECT AVG(citizen_rating) FROM complaints
                   WHERE citizen_id=c.citizen_id AND citizen_rating IS NOT NULL) AS avg_rating_given
           FROM citizens c
           JOIN wards w ON c.ward_id = w.ward_id
           WHERE c.citizen_id=$1""",
        payload["sub"],
    )
    if not row:
        raise HTTPException(404)
    return dict(row)


@router.patch("/profile")
async def update_profile(
    body: ProfileUpdateRequest,
    payload=Depends(require_citizen),
    pool=Depends(get_db),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"message": "Nothing to update"}

    set_clauses = ", ".join(f"{k}=${i+2}" for i, k in enumerate(updates.keys()))
    values = list(updates.values())
    await pool.execute(
        f"UPDATE citizens SET {set_clauses} WHERE citizen_id=$1",
        payload["sub"], *values,
    )
    return {"message": "Profile updated"}


@router.get("/ward-digest")
async def citizen_ward_digest(
    ward_id: int,
    payload=Depends(require_citizen),
    pool=Depends(get_db),
):
    """Return last 4 weekly digests for the citizen's ward."""
    rows = await pool.fetch(
        """SELECT d.*, w.ward_name
           FROM weekly_digests d
           JOIN wards w ON d.ward_id = w.ward_id
           WHERE d.ward_id=$1 AND d.is_published=TRUE
           ORDER BY d.week_start DESC LIMIT 4""",
        ward_id,
    )
    return {"digests": [dict(r) for r in rows]}


@router.get("/stats")
async def my_stats(payload=Depends(require_citizen), pool=Depends(get_db)):
    """Detailed activity stats for profile page."""
    cid = payload["sub"]
    cat_breakdown = await pool.fetch(
        """SELECT category, COUNT(*) AS count
           FROM complaints WHERE citizen_id=$1 AND category IS NOT NULL
           GROUP BY category ORDER BY count DESC""",
        cid,
    )
    monthly = await pool.fetch(
        """SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS count
           FROM complaints WHERE citizen_id=$1
           GROUP BY month ORDER BY month DESC LIMIT 6""",
        cid,
    )
    return {
        "category_breakdown": [dict(r) for r in cat_breakdown],
        "monthly_activity": [dict(r) for r in monthly],
    }