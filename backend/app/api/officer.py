"""Officer-specific endpoints: performance, ward map data, GPS update."""
from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.middleware.auth_middleware import require_officer

router = APIRouter(tags=["officer"])


@router.get("/me/performance")
async def my_performance(payload=Depends(require_officer), pool=Depends(get_db)):
    officer_id = payload["sub"]
    row = await pool.fetchrow(
        """SELECT o.officer_id, o.employee_id, o.name, o.email, o.phone_number,
                  o.ward_id, o.designation, o.is_active, o.created_at,
                  COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved','closed')) AS open_count,
                  COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed')
                    AND c.resolved_at >= NOW() - INTERVAL '7 days') AS resolved_week,
                  COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed')) AS total_resolved,
                  AVG(c.citizen_rating) FILTER (WHERE c.citizen_rating IS NOT NULL) AS avg_rating_live,
                  COUNT(c.complaint_id) FILTER (WHERE c.sla_breached = TRUE) AS breaches_total,
                  ROUND(
                    100.0 * COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed') AND c.sla_breached = FALSE)
                    / NULLIF(COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed')), 0),
                    1
                  ) AS sla_compliance_rate
           FROM officers o
           LEFT JOIN complaints c ON c.officer_id = o.officer_id
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
                  latitude, longitude, address, created_at
           FROM complaints
           WHERE ward_id=$1 AND status NOT IN ('resolved','closed')
             AND latitude IS NOT NULL
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
        """SELECT o.officer_id, o.name AS full_name, o.designation,
                  COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed')) AS total_resolved,
                  ROUND(
                    100.0 * COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed') AND c.sla_breached = FALSE)
                    / NULLIF(COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed')), 0),
                    1
                  ) AS sla_compliance_rate,
                  AVG(c.citizen_rating) FILTER (WHERE c.citizen_rating IS NOT NULL) AS citizen_rating_avg,
                  ROUND(
                    (
                      COALESCE(100.0 * COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed') AND c.sla_breached = FALSE)
                        / NULLIF(COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed')), 0), 50)
                      + COALESCE(AVG(c.citizen_rating) FILTER (WHERE c.citizen_rating IS NOT NULL) * 20, 50)
                    ) / 2,
                    1
                  ) AS performance_score
           FROM officers o
           LEFT JOIN complaints c ON c.officer_id = o.officer_id
           WHERE o.ward_id=$1 AND o.is_active=TRUE
           GROUP BY o.officer_id, o.name, o.designation
           ORDER BY performance_score DESC NULLS LAST""",
        officer["ward_id"],
    )
    return {"leaderboard": [dict(r) for r in rows]}