"""
Admin / Commissioner API — updated for v7 schema.
v7 changes:
  officers.full_name → name
  officers: no sla_compliance_rate, citizen_rating_avg, performance_score,
            total_assigned, total_resolved, avg_resolution_hours cols
  complaints: no disputed, sub_category, department, acknowledged_at,
              assigned_at, location_hash, location_address, original_language cols
              assigned_officer_id → officer_id
  predictive_alerts: is_resolved → is_active (inverted), no narrative col
"""
import logging
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.core.database import get_db
from app.middleware.auth_middleware import require_admin

router = APIRouter(tags=["admin"])
logger = logging.getLogger(__name__)


# ─── CITY OVERVIEW ─────────────────────────────────────────────────────────────
@router.get("/overview")
async def city_overview(pool=Depends(get_db), _=Depends(require_admin)):
    stats = await pool.fetchrow(
        """SELECT
               COUNT(*)                                                    AS total_complaints,
               COUNT(*) FILTER (WHERE status IN ('resolved','closed'))     AS total_resolved,
               COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed')) AS total_open,
               COUNT(*) FILTER (WHERE sla_breached = TRUE AND status NOT IN ('resolved','closed')) AS overdue,
               COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS new_today,
               COUNT(*) FILTER (WHERE resolved_at >= NOW() - INTERVAL '24 hours') AS resolved_today,
               AVG(citizen_rating) FILTER (WHERE citizen_rating IS NOT NULL) AS avg_rating
           FROM complaints"""
    )

    ward_grades = await pool.fetch(
        "SELECT health_grade, COUNT(*) AS count FROM wards GROUP BY health_grade ORDER BY health_grade"
    )

    top_categories = await pool.fetch(
        """SELECT category, COUNT(*) AS count
           FROM complaints
           WHERE created_at >= NOW() - INTERVAL '7 days'
             AND category IS NOT NULL
           GROUP BY category ORDER BY count DESC LIMIT 5"""
    )

    # v7: is_active=TRUE means alert is active (not is_resolved=FALSE)
    active_alerts = await pool.fetchval(
        "SELECT COUNT(*) FROM predictive_alerts WHERE is_active = TRUE"
    ) or 0

    return {
        "stats": dict(stats),
        "ward_grades": [dict(r) for r in ward_grades],
        "top_categories": [dict(r) for r in top_categories],
        "active_alerts": active_alerts,
    }


# ─── HEATMAP DATA ─────────────────────────────────────────────────────────────
@router.get("/wards/heatmap")
async def wards_heatmap(pool=Depends(get_db)):
    """Public-ish — used by landing page map. No auth to allow embed."""
    rows = await pool.fetch(
        """SELECT w.ward_id, w.ward_name, w.zone, w.lat_center, w.lng_center,
                  w.health_score, w.health_grade,
                  COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved','closed')) AS open_count,
                  COUNT(c.complaint_id) FILTER (WHERE c.resolved_at >= NOW() - INTERVAL '7 days') AS resolved_week,
                  COUNT(c.complaint_id) FILTER (WHERE c.sla_breached AND c.status NOT IN ('resolved','closed')) AS overdue_count,
                  mode() WITHIN GROUP (ORDER BY c.category) AS top_category
           FROM wards w
           LEFT JOIN complaints c ON c.ward_id = w.ward_id
           GROUP BY w.ward_id
           ORDER BY w.ward_id"""
    )
    return {"wards": [dict(r) for r in rows]}


# ─── WARD DRILL-DOWN ──────────────────────────────────────────────────────────
@router.get("/wards/{ward_id}")
async def ward_drilldown(ward_id: int, pool=Depends(get_db), _=Depends(require_admin)):
    ward = await pool.fetchrow("SELECT * FROM wards WHERE ward_id=$1", ward_id)
    if not ward:
        raise HTTPException(404)

    # 30-day complaint breakdown
    breakdown = await pool.fetch(
        """SELECT category, urgency, status,
                  COUNT(*) AS count,
                  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)
                      FILTER (WHERE resolved_at IS NOT NULL) AS avg_hours
           FROM complaints
           WHERE ward_id=$1 AND created_at >= NOW() - INTERVAL '30 days'
           GROUP BY category, urgency, status
           ORDER BY count DESC""",
        ward_id,
    )

    # Officers in this ward — v7: name not full_name, no perf stats cols
    officers = await pool.fetch(
        """SELECT o.officer_id, o.name AS full_name, o.designation,
                  COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved','closed')) AS open_count,
                  COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed')) AS resolved_count
           FROM officers o
           LEFT JOIN complaints c ON c.officer_id = o.officer_id
           WHERE o.ward_id=$1 AND o.is_active=TRUE
           GROUP BY o.officer_id
           ORDER BY resolved_count DESC""",
        ward_id,
    )

    # Health score history
    health_history = await pool.fetch(
        """SELECT calculated_at, composite_score
           FROM ward_health_scores
           WHERE ward_id=$1
           ORDER BY calculated_at DESC LIMIT 30""",
        ward_id,
    )

    # Active predictive alerts — v7: is_active=TRUE (not is_resolved=FALSE)
    alerts = await pool.fetch(
        """SELECT * FROM predictive_alerts
           WHERE ward_id=$1 AND is_active=TRUE
           ORDER BY created_at DESC""",
        ward_id,
    )

    # Latest digest
    digest = await pool.fetchrow(
        "SELECT * FROM weekly_digests WHERE ward_id=$1 AND is_published=TRUE ORDER BY week_start DESC LIMIT 1",
        ward_id,
    )

    # Top 5 open complaints
    top_complaints = await pool.fetch(
        """SELECT complaint_id, title, category, urgency, status, created_at, sla_deadline
           FROM complaints
           WHERE ward_id=$1 AND status NOT IN ('resolved','closed')
           ORDER BY CASE urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
                    sla_deadline ASC NULLS LAST
           LIMIT 5""",
        ward_id,
    )

    return {
        "ward": dict(ward),
        "breakdown": [dict(r) for r in breakdown],
        "officers": [dict(r) for r in officers],
        "health_history": [dict(r) for r in health_history],
        "alerts": [dict(r) for r in alerts],
        "digest": dict(digest) if digest else None,
        "top_complaints": [dict(r) for r in top_complaints],
    }


# ─── PREDICTIVE ALERTS ────────────────────────────────────────────────────────
@router.get("/alerts")
async def get_alerts(pool=Depends(get_db), _=Depends(require_admin)):
    # v7: is_active=TRUE (not is_resolved=FALSE)
    rows = await pool.fetch(
        """SELECT pa.*, w.ward_name, w.zone
           FROM predictive_alerts pa
           JOIN wards w ON pa.ward_id = w.ward_id
           WHERE pa.is_active = TRUE
           ORDER BY CASE pa.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
                    pa.created_at DESC""",
    )
    return {"alerts": [dict(r) for r in rows]}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, pool=Depends(get_db), _=Depends(require_admin)):
    # v7: set is_active=FALSE to resolve
    await pool.execute(
        "UPDATE predictive_alerts SET is_active=FALSE WHERE alert_id=$1",
        alert_id,
    )
    return {"resolved": True}


# ─── OFFICER MANAGEMENT ───────────────────────────────────────────────────────
@router.get("/officers")
async def all_officers(pool=Depends(get_db), _=Depends(require_admin)):
    # v7: name not full_name, no perf metric cols, complaints.officer_id (not assigned_officer_id)
    rows = await pool.fetch(
        """SELECT o.officer_id, o.name AS full_name, o.employee_id, o.designation,
                  o.ward_id, w.ward_name, o.is_active,
                  COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved','closed')) AS open_count,
                  COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed')) AS resolved_count,
                  COUNT(c.complaint_id) AS total_assigned,
                  AVG(c.citizen_rating) FILTER (WHERE c.citizen_rating IS NOT NULL) AS citizen_rating_avg
           FROM officers o
           LEFT JOIN wards w ON o.ward_id = w.ward_id
           LEFT JOIN complaints c ON c.officer_id = o.officer_id
           GROUP BY o.officer_id, w.ward_name
           ORDER BY resolved_count DESC NULLS LAST""",
    )
    return {"officers": [dict(r) for r in rows]}


# ─── WEEKLY DIGESTS ───────────────────────────────────────────────────────────
@router.get("/digests")
async def list_digests(pool=Depends(get_db), _=Depends(require_admin)):
    rows = await pool.fetch(
        """SELECT d.digest_id, d.ward_id, w.ward_name, d.week_start, d.week_end,
                  d.total_complaints, d.resolved_complaints, d.resolution_rate,
                  d.health_score_start, d.health_score_end, d.score_change,
                  d.is_published
           FROM weekly_digests d
           JOIN wards w ON d.ward_id = w.ward_id
           WHERE d.digest_type = 'ward'
           ORDER BY d.week_start DESC, w.ward_name ASC
           LIMIT 300""",
    )
    return {"digests": [dict(r) for r in rows]}


@router.get("/digests/{ward_id}/{week_start}")
async def get_digest(ward_id: int, week_start: str, pool=Depends(get_db), _=Depends(require_admin)):
    try:
        week_start_date = datetime.strptime(week_start, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")

    row = await pool.fetchrow(
        "SELECT * FROM weekly_digests WHERE ward_id=$1 AND week_start=$2",
        ward_id, week_start_date,
    )
    if not row:
        raise HTTPException(404, "Digest not found")
    return dict(row)


@router.post("/digests/trigger")
async def trigger_digest(
    background_tasks: BackgroundTasks,
    pool=Depends(get_db),
    _=Depends(require_admin),
):
    from app.services.weekly_digest_service import generate_all_ward_digests
    background_tasks.add_task(generate_all_ward_digests, pool)
    return {"message": "Weekly digest generation started in background for all 272 wards."}


# ─── HEALTH RECALCULATION ─────────────────────────────────────────────────────
@router.post("/health/recalculate")
async def recalculate_health(
    background_tasks: BackgroundTasks,
    pool=Depends(get_db),
    _=Depends(require_admin),
):
    from app.services.ward_health_service import recalculate_all_wards
    background_tasks.add_task(recalculate_all_wards, pool)
    return {"message": "Health recalculation started for all 272 wards."}


# ─── PREDICTIVE ALERTS TRIGGER ────────────────────────────────────────────────
@router.post("/alerts/scan")
async def trigger_alert_scan(
    background_tasks: BackgroundTasks,
    pool=Depends(get_db),
    _=Depends(require_admin),
):
    from app.services.predictive_alerts import run_predictive_alerts
    background_tasks.add_task(run_predictive_alerts, pool)
    return {"message": "Predictive alert scan started."}