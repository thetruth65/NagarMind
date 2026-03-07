"""Officer-specific endpoints: performance, ward map data, GPS update."""
from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.middleware.auth_middleware import require_officer

router = APIRouter(prefix="/api/officer", tags=["officer"])


@router.get("/me/performance")
async def my_performance(payload=Depends(require_officer), pool=Depends(get_db)):
    officer_id = payload["sub"]
    row = await pool.fetchrow(
        """SELECT o.*,
                  COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved','closed')) AS open_count,
                  COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed')
                    AND c.resolved_at >= NOW() - INTERVAL '7 days') AS resolved_week,
                  AVG(c.citizen_rating) FILTER (WHERE c.citizen_rating IS NOT NULL) AS avg_rating_live,
                  COUNT(c.complaint_id) FILTER (WHERE c.sla_breached = TRUE) AS breaches_total
           FROM officers o
           LEFT JOIN complaints c ON c.assigned_officer_id = o.officer_id
           WHERE o.officer_id = $1
           GROUP BY o.officer_id""",
        officer_id,
    )
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404)
    d = dict(row)
    d.pop("password_hash", None)
    return d


@router.patch("/me/location")
async def update_location(
    lat: float, lng: float,
    payload=Depends(require_officer), pool=Depends(get_db),
):
    await pool.execute(
        """UPDATE officers SET current_lat=$1, current_lng=$2, location_updated_at=NOW()
           WHERE officer_id=$3""",
        lat, lng, payload["sub"],
    )
    return {"updated": True}


@router.get("/ward/complaints")
async def ward_complaints_map(
    payload=Depends(require_officer), pool=Depends(get_db),
):
    """All open complaints in officer's ward with coordinates — for map pins."""
    officer = await pool.fetchrow(
        "SELECT ward_id FROM officers WHERE officer_id=$1", payload["sub"]
    )
    if not officer or not officer["ward_id"]:
        return {"complaints": []}

    rows = await pool.fetch(
        """SELECT complaint_id, title, category, urgency, status,
                  location_lat, location_lng, location_address, created_at
           FROM complaints
           WHERE ward_id=$1 AND status NOT IN ('resolved','closed')
             AND location_lat IS NOT NULL
           ORDER BY created_at DESC""",
        officer["ward_id"],
    )
    return {"complaints": [dict(r) for r in rows]}


@router.get("/leaderboard")
async def ward_leaderboard(
    payload=Depends(require_officer), pool=Depends(get_db),
):
    officer = await pool.fetchrow(
        "SELECT ward_id FROM officers WHERE officer_id=$1", payload["sub"]
    )
    rows = await pool.fetch(
        """SELECT o.officer_id, o.full_name, o.designation,
                  o.total_resolved, o.sla_compliance_rate, o.citizen_rating_avg,
                  o.performance_score
           FROM officers o
           WHERE o.ward_id=$1 AND o.is_active=TRUE
           ORDER BY o.performance_score DESC NULLS LAST""",
        officer["ward_id"],
    )
    return {"leaderboard": [dict(r) for r in rows]}