# """Ward listing and digest API."""
# from fastapi import APIRouter, Depends, HTTPException
# from app.core.database import get_db

# router = APIRouter(tags=["wards"])

# @router.get("/")
# async def list_wards(pool=Depends(get_db)):
#     rows = await pool.fetch("SELECT ward_id, ward_name, zone, health_score, health_grade FROM wards ORDER BY ward_name ASC")
#     return [dict(r) for r in rows]

# @router.get("/health/all")
# async def all_ward_health(pool=Depends(get_db)):
#     rows = await pool.fetch("SELECT ward_id, ward_name, zone, health_score, health_grade, lat_center, lng_center FROM (SELECT w.*, (SELECT COUNT(*) FROM complaints c WHERE c.ward_id=w.ward_id AND status NOT IN ('resolved','closed')) as open_count, (SELECT COUNT(*) FROM complaints c WHERE c.ward_id=w.ward_id AND resolved_at > NOW() - INTERVAL '7 days') as resolved_week, (SELECT COUNT(*) FROM complaints c WHERE c.ward_id=w.ward_id AND sla_breached=TRUE) as overdue_count FROM wards w) as stats")
#     return[dict(r) for r in rows]

# # ✅ FIX: This MUST be placed above `/{ward_id}`
# @router.get("/digests/history")
# async def get_digest_history(type: str, entity_id: str = None, pool=Depends(get_db)):
#     if type == 'city':
#         rows = await pool.fetch("SELECT * FROM weekly_digests WHERE digest_type='city' ORDER BY week_start DESC")
#         entity_name = "MCD Delhi"
#     elif type == 'zone':
#         rows = await pool.fetch("SELECT * FROM weekly_digests WHERE digest_type='zone' AND zone_name=$1 ORDER BY week_start DESC", entity_id)
#         entity_name = f"{entity_id} Zone"
#     else: 
#         if not entity_id or not entity_id.isdigit():
#             raise HTTPException(400, "Ward ID must be a number")
#         rows = await pool.fetch("SELECT * FROM weekly_digests WHERE digest_type='ward' AND ward_id=$1 ORDER BY week_start DESC", int(entity_id))
#         w = await pool.fetchrow("SELECT ward_name FROM wards WHERE ward_id=$1", int(entity_id))
#         entity_name = w['ward_name'] if w else f"Ward {entity_id}"

#     res =[]
#     for r in rows:
#         d = dict(r)
#         d['ward_name'] = entity_name
#         res.append(d)
#     return {"digests": res}

# @router.get("/digest/{digest_id}")
# async def get_digest_by_id(digest_id: str, pool=Depends(get_db)):
#     row = await pool.fetchrow("SELECT * FROM weekly_digests WHERE digest_id = $1", digest_id)
#     if not row: raise HTTPException(404, "Digest not found")
#     return dict(row)

# # ✅ CATCH-ALL ROUTE GOES AT THE VERY BOTTOM
# @router.get("/{ward_id}")
# async def get_ward_detail(ward_id: int, pool=Depends(get_db)):
#     row = await pool.fetchrow("SELECT * FROM wards WHERE ward_id=$1", ward_id)
#     if not row: raise HTTPException(404)
#     return dict(row)

"""
Wards API — NagarMind

Routes:
  GET /api/wards/                    → List all wards
  GET /api/wards/health/all          → All wards with health scores
  GET /api/wards/digests/history     → ✅ FIXED: was 404, now returns digest history
  GET /api/wards/digest/{digest_id}  → Get one digest by ID
  GET /api/wards/{ward_id}           → Get ward detail
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.database import get_db

router = APIRouter(tags=["wards"])
logger = logging.getLogger(__name__)


# ─── LIST ALL WARDS ───────────────────────────────────────────────────────────
@router.get("/")
async def list_wards(pool=Depends(get_db)):
    rows = await pool.fetch(
        """SELECT ward_id, ward_name, zone, district,
                  health_score, complaint_count, resolved_count
           FROM wards
           ORDER BY ward_name ASC"""
    )
    return [dict(r) for r in rows]


# ─── ALL WARDS HEALTH ────────────────────────────────────────────────────────
@router.get("/health/all")
async def all_wards_health(pool=Depends(get_db)):
    rows = await pool.fetch(
        """SELECT ward_id, ward_name, zone, health_score,
                  complaint_count, resolved_count, sla_breach_count,
                  avg_resolution_hours, last_updated
           FROM wards
           ORDER BY health_score ASC NULLS LAST"""
    )
    return {"wards": [dict(r) for r in rows]}


# ─── DIGEST HISTORY ───────────────────────────────────────────────────────────
# ✅ FIX: This route was missing, causing 404 on /api/wards/digests/history
# IMPORTANT: This must come BEFORE /{ward_id} to avoid path conflicts
@router.get("/digests/history")
async def digest_history(
    type: str = Query(..., description="'ward', 'zone', or 'city'"),
    entity_id: Optional[str] = Query(None, description="Ward ID or zone name"),
    limit: int = Query(12, le=52),
    pool=Depends(get_db),
):
    """
    Returns weekly digest history for charts and trend analysis.
    Used by WeeklyDigestPage for admin and officer views.
    """
    conditions = []
    params = []

    if type == "ward" and entity_id:
        conditions.append(f"ward_id = ${len(params)+1}::int")
        params.append(int(entity_id))
    elif type == "zone" and entity_id:
        conditions.append(f"zone = ${len(params)+1}")
        params.append(entity_id)
    elif type == "city":
        pass  # no filter needed

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = await pool.fetch(
        f"""SELECT
               d.digest_id,
               d.ward_id,
               d.week_start,
               d.week_end,
               d.total_complaints,
               d.resolved_complaints,
               d.avg_resolution_hours,
               d.top_category,
               d.health_score,
               d.sla_compliance_rate,
               d.generated_at,
               w.ward_name,
               w.zone
           FROM ward_weekly_digests d
           LEFT JOIN wards w ON d.ward_id = w.ward_id
           {where}
           ORDER BY d.week_start DESC
           LIMIT {limit}""",
        *params,
    )

    return {
        "history": [dict(r) for r in rows],
        "total": len(rows),
        "type": type,
        "entity_id": entity_id,
    }


# ─── GET DIGEST BY ID ────────────────────────────────────────────────────────
@router.get("/digest/{digest_id}")
async def get_digest(digest_id: str, pool=Depends(get_db)):
    row = await pool.fetchrow(
        """SELECT d.*, w.ward_name, w.zone
           FROM ward_weekly_digests d
           LEFT JOIN wards w ON d.ward_id = w.ward_id
           WHERE d.digest_id = $1::uuid""",
        digest_id,
    )
    if not row:
        raise HTTPException(404, "Digest not found")
    return dict(row)


# ─── GET WARD DETAIL ─────────────────────────────────────────────────────────
# ✅ This must come AFTER /digests/history and /health/all to avoid path conflicts
@router.get("/{ward_id}")
async def get_ward(ward_id: int, pool=Depends(get_db)):
    row = await pool.fetchrow(
        """SELECT w.*,
                  COUNT(c.complaint_id) FILTER (WHERE c.status != 'resolved') AS open_complaints,
                  COUNT(c.complaint_id) FILTER (WHERE c.status = 'resolved') AS resolved_total
           FROM wards w
           LEFT JOIN complaints c ON w.ward_id = c.ward_id
           WHERE w.ward_id = $1
           GROUP BY w.ward_id""",
        ward_id,
    )
    if not row:
        raise HTTPException(404, f"Ward {ward_id} not found")
    return dict(row)