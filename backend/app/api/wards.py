"""
Wards API — NagarMind

Routes:
  GET /api/wards/                    → List all wards
  GET /api/wards/health/all          → All wards with health scores
  GET /api/wards/digests/history     → Digest history (ward / zone / city)
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
        """SELECT ward_id, ward_name, zone, health_score, health_grade, lat_center, lng_center
           FROM wards
           ORDER BY ward_name ASC"""
    )
    return [dict(r) for r in rows]


# ─── ALL WARDS HEALTH ────────────────────────────────────────────────────────
@router.get("/health/all")
async def all_wards_health(pool=Depends(get_db)):
    rows = await pool.fetch(
        """SELECT ward_id, ward_name, zone, health_score, health_grade, lat_center, lng_center
           FROM wards
           ORDER BY health_score ASC NULLS LAST"""
    )
    return {"wards": [dict(r) for r in rows]}


# ─── DIGEST HISTORY ───────────────────────────────────────────────────────────
# MUST come before /{ward_id} to avoid path conflict
@router.get("/digests/history")
async def digest_history(
    type: str  = Query(..., description="'ward', 'zone', or 'city'"),
    entity_id: Optional[str] = Query(None, description="Ward ID (int) or zone name (str)"),
    limit: int = Query(12, le=52),
    pool=Depends(get_db),
):
    """
    Returns weekly digest history.

    type=ward  → entity_id = ward_id (int)  → ward-level rows
    type=zone  → entity_id = zone name      → zone-level aggregate rows
    type=city  → no entity_id needed        → city-level aggregate row
    """

    if type == "ward":
        if not entity_id:
            raise HTTPException(400, "entity_id (ward_id) required for type=ward")
        try:
            ward_id = int(entity_id)
        except ValueError:
            raise HTTPException(400, "entity_id must be an integer for type=ward")

        rows = await pool.fetch(
            """SELECT d.*, w.ward_name, w.zone
               FROM weekly_digests d
               LEFT JOIN wards w ON d.ward_id = w.ward_id
               WHERE d.digest_type = 'ward'
                 AND d.ward_id = $1
               ORDER BY d.week_start DESC
               LIMIT $2""",
            ward_id, limit,
        )

    elif type == "zone":
        if not entity_id:
            raise HTTPException(400, "entity_id (zone name) required for type=zone")

        rows = await pool.fetch(
            """SELECT d.*,
                      NULL::int    AS ward_id_unused,
                      $1::text     AS ward_name,   -- use zone name as display title
                      $1::text     AS zone
               FROM weekly_digests d
               WHERE d.digest_type = 'zone'
                 AND d.zone_name   = $1
               ORDER BY d.week_start DESC
               LIMIT $2""",
            entity_id, limit,
        )

        # ── Fallback: if zone-level rows not yet generated, aggregate ward rows ──
        if not rows:
            rows = await pool.fetch(
                """SELECT
                       NULL::uuid             AS digest_id,
                       'zone'                 AS digest_type,
                       NULL::int              AS ward_id,
                       $1::text               AS zone_name,
                       d.week_start,
                       d.week_end,
                       SUM(d.total_complaints)    AS total_complaints,
                       SUM(d.resolved_complaints) AS resolved_complaints,
                       SUM(d.pending_complaints)  AS pending_complaints,
                       ROUND(AVG(d.resolution_rate)::decimal, 1) AS resolution_rate,
                       ROUND(AVG(d.avg_resolution_hours)::decimal, 1) AS avg_resolution_hours,
                       mode() WITHIN GROUP (ORDER BY d.top_category) AS top_category,
                       ROUND(AVG(d.health_score_end)::decimal, 2)   AS health_score_end,
                       ROUND(AVG(d.health_score_start)::decimal, 2) AS health_score_start,
                       ROUND(AVG(d.score_change)::decimal, 2)       AS score_change,
                       NULL::text AS summary_en,
                       NULL::text AS summary_hi,
                       NULL::text[] AS key_achievements,
                       NULL::text[] AS areas_of_concern,
                       $1::text    AS ward_name,
                       $1::text    AS zone
                   FROM weekly_digests d
                   JOIN wards w ON d.ward_id = w.ward_id
                   WHERE d.digest_type = 'ward'
                     AND w.zone = $1
                   GROUP BY d.week_start, d.week_end
                   ORDER BY d.week_start DESC
                   LIMIT $2""",
                entity_id, limit,
            )

    elif type == "city":
        rows = await pool.fetch(
            """SELECT d.*,
                      NULL::int    AS ward_id_unused,
                      'MCD Delhi'  AS ward_name,
                      'All Zones'  AS zone
               FROM weekly_digests d
               WHERE d.digest_type = 'city'
               ORDER BY d.week_start DESC
               LIMIT $1""",
            limit,
        )

        # ── Fallback: aggregate all ward rows if city rows not yet generated ──
        if not rows:
            rows = await pool.fetch(
                """SELECT
                       NULL::uuid             AS digest_id,
                       'city'                 AS digest_type,
                       NULL::int              AS ward_id,
                       NULL::text             AS zone_name,
                       d.week_start,
                       d.week_end,
                       SUM(d.total_complaints)    AS total_complaints,
                       SUM(d.resolved_complaints) AS resolved_complaints,
                       SUM(d.pending_complaints)  AS pending_complaints,
                       ROUND(AVG(d.resolution_rate)::decimal, 1)       AS resolution_rate,
                       ROUND(AVG(d.avg_resolution_hours)::decimal, 1)  AS avg_resolution_hours,
                       mode() WITHIN GROUP (ORDER BY d.top_category)   AS top_category,
                       ROUND(AVG(d.health_score_end)::decimal, 2)      AS health_score_end,
                       ROUND(AVG(d.health_score_start)::decimal, 2)    AS health_score_start,
                       ROUND(AVG(d.score_change)::decimal, 2)          AS score_change,
                       NULL::text   AS summary_en,
                       NULL::text   AS summary_hi,
                       NULL::text[] AS key_achievements,
                       NULL::text[] AS areas_of_concern,
                       'MCD Delhi'  AS ward_name,
                       'All Zones'  AS zone
                   FROM weekly_digests d
                   WHERE d.digest_type = 'ward'
                   GROUP BY d.week_start, d.week_end
                   ORDER BY d.week_start DESC
                   LIMIT $1""",
                limit,
            )

    else:
        raise HTTPException(400, "type must be 'ward', 'zone', or 'city'")

    # Serialize — handle Decimal and UUID types safely
    digests = []
    for r in rows:
        row_dict = dict(r)
        # Coerce Decimal fields to float for JSON
        for key in ("resolution_rate", "avg_resolution_hours",
                    "health_score_end", "health_score_start", "score_change"):
            if row_dict.get(key) is not None:
                row_dict[key] = float(row_dict[key])
        # UUID → str
        if row_dict.get("digest_id") is not None:
            row_dict["digest_id"] = str(row_dict["digest_id"])
        digests.append(row_dict)

    return {
        "digests":   digests,
        "total":     len(digests),
        "type":      type,
        "entity_id": entity_id,
    }


# ─── GET DIGEST BY ID ────────────────────────────────────────────────────────
@router.get("/digest/{digest_id}")
async def get_digest(digest_id: str, pool=Depends(get_db)):
    row = await pool.fetchrow(
        """SELECT d.*, w.ward_name, w.zone
           FROM weekly_digests d
           LEFT JOIN wards w ON d.ward_id = w.ward_id
           WHERE d.digest_id = $1::uuid""",
        digest_id,
    )
    if not row:
        raise HTTPException(404, "Digest not found")
    return dict(row)


# ─── GET WARD DETAIL ─────────────────────────────────────────────────────────
# MUST come after /digests/history and /health/all
@router.get("/{ward_id}")
async def get_ward(ward_id: int, pool=Depends(get_db)):
    row = await pool.fetchrow(
        """SELECT w.*,
                  COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved','closed')) AS open_complaints,
                  COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed'))     AS resolved_total
           FROM wards w
           LEFT JOIN complaints c ON w.ward_id = c.ward_id
           WHERE w.ward_id = $1
           GROUP BY w.ward_id""",
        ward_id,
    )
    if not row:
        raise HTTPException(404, f"Ward {ward_id} not found")
    return dict(row)