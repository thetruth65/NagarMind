"""
Analytics API — Phase 4
Deep-dive trends, zone comparisons, export, category intelligence.
"""
import logging
from datetime import datetime, timedelta, timezone, date
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from app.core.database import get_db
from app.middleware.auth_middleware import require_admin

router = APIRouter(tags=["analytics"])
logger = logging.getLogger(__name__)


@router.get("/city/trends")
async def city_trends(
    days: int = Query(30, ge=7, le=365),
    pool=Depends(get_db),
    _=Depends(require_admin),
):
    """Daily complaint volume + resolution + SLA compliance over N days."""
    rows = await pool.fetch(
        """
        SELECT
            DATE(created_at) AS day,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved,
            COUNT(*) FILTER (WHERE sla_breached = TRUE) AS breached,
            AVG(citizen_rating) FILTER (WHERE citizen_rating IS NOT NULL) AS avg_rating
        FROM complaints
        WHERE created_at >= NOW() - MAKE_INTERVAL(days => $1)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
        """,
        days,
    )
    return {"trends": [dict(r) for r in rows], "days": days}


@router.get("/city/category-breakdown")
async def category_breakdown(
    days: int = Query(30),
    pool=Depends(get_db),
    _=Depends(require_admin),
):
    """Category breakdown with resolution rates and avg SLA."""
    rows = await pool.fetch(
        """
        SELECT
            category,
            urgency,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved,
            ROUND(COUNT(*) FILTER (WHERE status IN ('resolved','closed'))::decimal
                  / NULLIF(COUNT(*), 0) * 100, 1) AS resolution_rate,
            AVG(sla_hours) AS avg_sla_hours,
            COUNT(*) FILTER (WHERE sla_breached = TRUE) AS breaches
        FROM complaints
        WHERE created_at >= NOW() - MAKE_INTERVAL(days => $1)
          AND category IS NOT NULL
        GROUP BY category, urgency
        ORDER BY total DESC
        """,
        days,
    )
    return {"breakdown": [dict(r) for r in rows]}


@router.get("/zones/comparison")
async def zone_comparison(
    pool=Depends(get_db),
    _=Depends(require_admin),
):
    """Compare all 5 MCD zones: North, South, East, West, North-West, South-West, Central."""
    rows = await pool.fetch(
        """
        SELECT
            w.zone,
            COUNT(DISTINCT w.ward_id) AS ward_count,
            COUNT(c.complaint_id) AS total_complaints,
            COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed')) AS resolved,
            ROUND(AVG(w.health_score)::decimal, 2) AS avg_health_score,
            COUNT(c.complaint_id) FILTER (WHERE c.sla_breached = TRUE) AS sla_breaches,
            ROUND(AVG(c.citizen_rating) FILTER (WHERE c.citizen_rating IS NOT NULL)::decimal, 2) AS avg_rating,
            mode() WITHIN GROUP (ORDER BY c.category) AS top_category
        FROM wards w
        LEFT JOIN complaints c ON c.ward_id = w.ward_id
          AND c.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY w.zone
        ORDER BY avg_health_score DESC NULLS LAST
        """
    )
    return {"zones": [dict(r) for r in rows]}


@router.get("/officers/leaderboard-full")
async def officer_leaderboard_full(
    limit: int = Query(50, le=272),
    pool=Depends(get_db),
    _=Depends(require_admin),
):
    """Full city-wide officer leaderboard with all metrics."""
    rows = await pool.fetch(
        """
        SELECT
            o.officer_id, o.full_name, o.employee_id, o.designation,
            o.department, o.ward_id, w.ward_name, o.zone,
            o.total_assigned, o.total_resolved, o.sla_compliance_rate,
            o.citizen_rating_avg, o.performance_score, o.is_active,
            COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved','closed')) AS open_count,
            COUNT(c.complaint_id) FILTER (
                WHERE c.resolved_at >= NOW() - INTERVAL '7 days') AS resolved_this_week,
            COUNT(c.complaint_id) FILTER (WHERE c.sla_breached = TRUE) AS total_breaches
        FROM officers o
        LEFT JOIN wards w ON o.ward_id = w.ward_id
        LEFT JOIN complaints c ON c.assigned_officer_id = o.officer_id
        GROUP BY o.officer_id, w.ward_name
        ORDER BY COALESCE(o.performance_score, 0) DESC
        LIMIT $1
        """,
        limit,
    )
    return {"officers": [dict(r) for r in rows], "total": len(rows)}


@router.get("/wards/worst")
async def worst_wards(
    limit: int = Query(10, le=50),
    pool=Depends(get_db),
    _=Depends(require_admin),
):
    """Bottom N wards by health score with drill-down data."""
    rows = await pool.fetch(
        """
        SELECT
            w.ward_id, w.ward_name, w.zone,
            w.health_score, w.health_grade,
            COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved','closed')) AS open_count,
            COUNT(c.complaint_id) FILTER (WHERE c.sla_breached = TRUE
                AND c.status NOT IN ('resolved','closed')) AS overdue_count,
            COUNT(DISTINCT o.officer_id) AS officer_count
        FROM wards w
        LEFT JOIN complaints c ON c.ward_id = w.ward_id
        LEFT JOIN officers o ON o.ward_id = w.ward_id AND o.is_active = TRUE
        GROUP BY w.ward_id
        ORDER BY w.health_score ASC NULLS LAST
        LIMIT $1
        """,
        limit,
    )
    return {"wards": [dict(r) for r in rows]}


@router.get("/wards/best")
async def best_wards(
    limit: int = Query(10, le=50),
    pool=Depends(get_db),
    _=Depends(require_admin),
):
    rows = await pool.fetch(
        """
        SELECT w.ward_id, w.ward_name, w.zone,
               w.health_score, w.health_grade
        FROM wards w
        ORDER BY w.health_score DESC NULLS LAST
        LIMIT $1
        """,
        limit,
    )
    return {"wards": [dict(r) for r in rows]}


@router.get("/export/complaints-csv")
async def export_complaints_csv(
    days: int = Query(30, le=365),
    pool=Depends(get_db),
    _=Depends(require_admin),
):
    """Export complaints as CSV for the past N days."""
    rows = await pool.fetch(
        """
        SELECT
            c.complaint_id, c.title, c.category, c.sub_category,
            c.urgency, c.status, c.department,
            w.ward_name, w.zone,
            c.location_address, c.location_lat, c.location_lng,
            c.created_at, c.assigned_at, c.resolved_at,
            c.sla_hours, c.sla_deadline, c.sla_breached,
            c.citizen_rating, c.disputed,
            c.original_language, c.submission_channel,
            o.full_name AS officer_name, o.designation AS officer_designation
        FROM complaints c
        JOIN wards w ON c.ward_id = w.ward_id
        LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
        WHERE c.created_at >= NOW() - MAKE_INTERVAL(days => $1)
        ORDER BY c.created_at DESC
        """,
        days,
    )

    if not rows:
        return Response("No data", media_type="text/csv")

    headers = list(rows[0].keys())
    lines = [",".join(str(h) for h in headers)]
    for row in rows:
        vals = []
        for h in headers:
            v = row[h]
            if v is None:
                vals.append("")
            elif isinstance(v, str) and ("," in v or "\n" in v or '"' in v):
                vals.append(f'"{v.replace(chr(34), chr(34)+chr(34))}"')
            else:
                vals.append(str(v))
        lines.append(",".join(vals))

    csv_content = "\n".join(lines)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=nagarmind_complaints_{days}d.csv"},
    )


@router.get("/export/officers-csv")
async def export_officers_csv(
    pool=Depends(get_db),
    _=Depends(require_admin),
):
    rows = await pool.fetch(
        """
        SELECT o.employee_id, o.full_name, o.designation, o.department,
               w.ward_name, o.zone, o.total_assigned, o.total_resolved,
               o.sla_compliance_rate, o.citizen_rating_avg, o.performance_score,
               o.is_active
        FROM officers o
        LEFT JOIN wards w ON o.ward_id = w.ward_id
        ORDER BY o.performance_score DESC NULLS LAST
        """
    )
    if not rows:
        return Response("No data", media_type="text/csv")

    headers = list(rows[0].keys())
    lines = [",".join(str(h) for h in headers)]
    for row in rows:
        vals = [str(row[h]) if row[h] is not None else "" for h in headers]
        lines.append(",".join(vals))

    return Response(
        content="\n".join(lines),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=nagarmind_officers.csv"},
    )


@router.get("/city/summary-card")
async def summary_card(pool=Depends(get_db)):
    """Public summary — for landing page / press release widget. No auth needed."""
    row = await pool.fetchrow(
        """
        SELECT
            COUNT(DISTINCT w.ward_id) AS total_wards,
            COUNT(c.complaint_id) AS total_complaints,
            COUNT(c.complaint_id) FILTER (WHERE c.status IN ('resolved','closed')) AS resolved,
            ROUND(AVG(w.health_score)::decimal, 1) AS city_health_score,
            COUNT(DISTINCT ci.citizen_id) AS registered_citizens,
            COUNT(DISTINCT o.officer_id) AS active_officers
        FROM wards w
        LEFT JOIN complaints c ON c.ward_id = w.ward_id
        LEFT JOIN citizens ci ON ci.ward_id = w.ward_id
        LEFT JOIN officers o ON o.ward_id = w.ward_id AND o.is_active = TRUE
        """
    )
    d = dict(row)
    total = d.get("total_complaints") or 1
    d["resolution_rate"] = round((d.get("resolved") or 0) / total * 100, 1)
    return d