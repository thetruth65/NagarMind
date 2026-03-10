"""
Agent 5: Weekly Digest Generator
Runs every Sunday 11 PM via APScheduler.
Generates ward + zone + city level digests.

FIXES:
  - Zone-level and city-level digests now generated
  - category_breakdown JSONB now populated
  - urgency_breakdown JSONB now populated
  - pending_complaints now written
  - All datetimes are timezone-aware (UTC) to match TIMESTAMPTZ columns
"""
import logging
import json
from datetime import datetime, timedelta, date, timezone
from app.services.gemini_service import generate_weekly_digest
from app.services.sarvam_service import translate_single

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC ENTRY POINT — called by scheduler & admin trigger
# ─────────────────────────────────────────────────────────────────────────────

async def generate_all_ward_digests(pool):
    """
    Generate weekly digests for:
      1. Every ward (272)
      2. Every zone (10 aggregates)
      3. Full city (1 aggregate)

    Called Sunday 11 PM, or manually via POST /api/admin/digests/trigger
    """
    now        = datetime.now(timezone.utc)
    week_end   = now.date()
    week_start = week_end - timedelta(days=7)

    # ── Ward digests ─────────────────────────────────────────────────────────
    wards     = await pool.fetch("SELECT ward_id, ward_name FROM wards ORDER BY ward_id")
    generated = 0
    for ward in wards:
        try:
            await _generate_ward_digest(pool, ward["ward_id"], ward["ward_name"],
                                        week_start, week_end)
            generated += 1
        except Exception as e:
            logger.error(f"Ward digest failed for {ward['ward_id']}: {e}")

    # ── Zone digests ─────────────────────────────────────────────────────────
    zones = await pool.fetch("SELECT DISTINCT zone FROM wards ORDER BY zone")
    for row in zones:
        try:
            await _generate_zone_digest(pool, row["zone"], week_start, week_end)
        except Exception as e:
            logger.error(f"Zone digest failed for {row['zone']}: {e}")

    # ── City digest ───────────────────────────────────────────────────────────
    try:
        await _generate_city_digest(pool, week_start, week_end)
    except Exception as e:
        logger.error(f"City digest failed: {e}")

    logger.info(f"Weekly digests: {generated}/{len(wards)} wards + zones + city done")
    return generated


# ─────────────────────────────────────────────────────────────────────────────
# WARD-LEVEL DIGEST
# ─────────────────────────────────────────────────────────────────────────────

async def _generate_ward_digest(pool, ward_id: int, ward_name: str,
                                 week_start: date, week_end: date):
    existing = await pool.fetchrow(
        "SELECT digest_id FROM weekly_digests WHERE ward_id=$1 AND week_start=$2 AND digest_type='ward'",
        ward_id, week_start,
    )
    if existing:
        return

    ws_dt = _to_utc(week_start)
    we_dt = _to_utc(week_end) + timedelta(days=1)   # exclusive upper bound

    # Core stats
    stats = await pool.fetchrow(
        """SELECT
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved,
               COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed')) AS pending,
               AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)
                   FILTER (WHERE resolved_at IS NOT NULL) AS avg_hours,
               mode() WITHIN GROUP (ORDER BY category) AS top_category,
               AVG(citizen_rating) FILTER (WHERE citizen_rating IS NOT NULL) AS avg_rating,
               COUNT(*) FILTER (WHERE sla_breached = TRUE) AS breach_count
           FROM complaints
           WHERE ward_id=$1 AND created_at >= $2 AND created_at < $3""",
        ward_id, ws_dt, we_dt,
    )

    # Category breakdown
    cat_rows = await pool.fetch(
        """SELECT category, COUNT(*) AS count
           FROM complaints
           WHERE ward_id=$1 AND created_at >= $2 AND created_at < $3
             AND category IS NOT NULL
           GROUP BY category ORDER BY count DESC""",
        ward_id, ws_dt, we_dt,
    )

    # Urgency breakdown
    urg_rows = await pool.fetch(
        """SELECT urgency, COUNT(*) AS count
           FROM complaints
           WHERE ward_id=$1 AND created_at >= $2 AND created_at < $3
           GROUP BY urgency ORDER BY count DESC""",
        ward_id, ws_dt, we_dt,
    )

    # Status breakdown
    status_rows = await pool.fetch(
        """SELECT status, COUNT(*) AS count
           FROM complaints
           WHERE ward_id=$1 AND created_at >= $2 AND created_at < $3
           GROUP BY status ORDER BY count DESC""",
        ward_id, ws_dt, we_dt,
    )

    total           = int(stats["total"] or 0)
    resolved        = int(stats["resolved"] or 0)
    pending         = int(stats["pending"] or 0)
    resolution_rate = round((resolved / max(total, 1)) * 100, 1)
    avg_hours       = round(float(stats["avg_hours"] or 0), 1)
    avg_rating      = round(float(stats["avg_rating"] or 0), 2)

    category_breakdown = [{"category": r["category"], "count": r["count"]} for r in cat_rows]
    urgency_breakdown  = [{"urgency": r["urgency"],   "count": r["count"]} for r in urg_rows]
    status_breakdown   = [{"status":  r["status"],    "count": r["count"]} for r in status_rows]

    score_start, score_end = await _get_health_score_range(pool, ward_id, ws_dt, we_dt)

    digest_stats = {
        "total": total, "resolved": resolved, "resolution_rate": resolution_rate,
        "avg_hours": avg_hours, "top_category": stats["top_category"] or "N/A",
        "avg_rating": avg_rating, "breach_count": int(stats["breach_count"] or 0),
        "score_start": score_start, "score_end": score_end,
        "overdue": int(stats["breach_count"] or 0),
    }

    summary_en = await generate_weekly_digest(ward_name, digest_stats)
    summary_hi = await _safe_translate(summary_en)

    achievements, concerns = _build_achievements_concerns(
        resolution_rate, avg_hours, score_start, score_end,
        stats["breach_count"], total
    )

    await pool.execute(
        """INSERT INTO weekly_digests
           (digest_type, ward_id, week_start, week_end,
            total_complaints, resolved_complaints, pending_complaints,
            resolution_rate, avg_resolution_hours, top_category,
            category_breakdown, urgency_breakdown,
            health_score_start, health_score_end, score_change,
            summary_en, summary_hi, key_achievements, areas_of_concern,
            is_published, published_at)
           VALUES ('ward',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,TRUE,NOW())
           ON CONFLICT (ward_id, week_start) DO UPDATE SET
               summary_en=EXCLUDED.summary_en, summary_hi=EXCLUDED.summary_hi,
               total_complaints=EXCLUDED.total_complaints,
               resolved_complaints=EXCLUDED.resolved_complaints,
               pending_complaints=EXCLUDED.pending_complaints,
               resolution_rate=EXCLUDED.resolution_rate,
               avg_resolution_hours=EXCLUDED.avg_resolution_hours,
               category_breakdown=EXCLUDED.category_breakdown,
               urgency_breakdown=EXCLUDED.urgency_breakdown,
               health_score_end=EXCLUDED.health_score_end,
               score_change=EXCLUDED.score_change,
               key_achievements=EXCLUDED.key_achievements,
               areas_of_concern=EXCLUDED.areas_of_concern,
               is_published=TRUE, published_at=NOW()""",
        ward_id, week_start, week_end,
        total, resolved, pending,
        resolution_rate, avg_hours,
        stats["top_category"] or "other",
        json.dumps(category_breakdown),
        json.dumps(urgency_breakdown),
        score_start, score_end, round(score_end - score_start, 2),
        summary_en, summary_hi, achievements, concerns,
    )
    logger.info(f"Ward digest: {ward_name} ({ward_id}) — {total} complaints, {resolution_rate}% resolved")


# ─────────────────────────────────────────────────────────────────────────────
# ZONE-LEVEL DIGEST
# ─────────────────────────────────────────────────────────────────────────────

async def _generate_zone_digest(pool, zone_name: str,
                                 week_start: date, week_end: date):
    # Zone digests use ward_id=NULL, zone_name=<zone>, digest_type='zone'
    existing = await pool.fetchrow(
        """SELECT digest_id FROM weekly_digests
           WHERE digest_type='zone' AND zone_name=$1 AND week_start=$2""",
        zone_name, week_start,
    )
    if existing:
        return

    ws_dt = _to_utc(week_start)
    we_dt = _to_utc(week_end) + timedelta(days=1)

    stats = await pool.fetchrow(
        """SELECT
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE c.status IN ('resolved','closed')) AS resolved,
               COUNT(*) FILTER (WHERE c.status NOT IN ('resolved','closed')) AS pending,
               AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/3600)
                   FILTER (WHERE c.resolved_at IS NOT NULL) AS avg_hours,
               mode() WITHIN GROUP (ORDER BY c.category) AS top_category,
               AVG(c.citizen_rating) FILTER (WHERE c.citizen_rating IS NOT NULL) AS avg_rating,
               COUNT(*) FILTER (WHERE c.sla_breached = TRUE) AS breach_count,
               ROUND(AVG(w.health_score)::decimal, 2) AS avg_health_score
           FROM complaints c
           JOIN wards w ON c.ward_id = w.ward_id
           WHERE w.zone=$1 AND c.created_at >= $2 AND c.created_at < $3""",
        zone_name, ws_dt, we_dt,
    )

    cat_rows = await pool.fetch(
        """SELECT c.category, COUNT(*) AS count
           FROM complaints c JOIN wards w ON c.ward_id = w.ward_id
           WHERE w.zone=$1 AND c.created_at >= $2 AND c.created_at < $3
             AND c.category IS NOT NULL
           GROUP BY c.category ORDER BY count DESC""",
        zone_name, ws_dt, we_dt,
    )

    urg_rows = await pool.fetch(
        """SELECT c.urgency, COUNT(*) AS count
           FROM complaints c JOIN wards w ON c.ward_id = w.ward_id
           WHERE w.zone=$1 AND c.created_at >= $2 AND c.created_at < $3
           GROUP BY c.urgency ORDER BY count DESC""",
        zone_name, ws_dt, we_dt,
    )

    total           = int(stats["total"] or 0)
    resolved        = int(stats["resolved"] or 0)
    pending         = int(stats["pending"] or 0)
    resolution_rate = round((resolved / max(total, 1)) * 100, 1)
    avg_hours       = round(float(stats["avg_hours"] or 0), 1)
    score_end       = float(stats["avg_health_score"] or 50)

    category_breakdown = [{"category": r["category"], "count": r["count"]} for r in cat_rows]
    urgency_breakdown  = [{"urgency":  r["urgency"],  "count": r["count"]} for r in urg_rows]

    digest_stats = {
        "total": total, "resolved": resolved, "resolution_rate": resolution_rate,
        "avg_hours": avg_hours, "top_category": stats["top_category"] or "N/A",
        "avg_rating": float(stats["avg_rating"] or 0),
        "breach_count": int(stats["breach_count"] or 0),
        "score_start": score_end, "score_end": score_end,
        "overdue": int(stats["breach_count"] or 0),
    }

    summary_en = await generate_weekly_digest(f"{zone_name} Zone", digest_stats)
    summary_hi = await _safe_translate(summary_en)

    achievements, concerns = _build_achievements_concerns(
        resolution_rate, avg_hours, score_end, score_end,
        stats["breach_count"], total
    )

    await pool.execute(
        """INSERT INTO weekly_digests
           (digest_type, zone_name, week_start, week_end,
            total_complaints, resolved_complaints, pending_complaints,
            resolution_rate, avg_resolution_hours, top_category,
            category_breakdown, urgency_breakdown,
            health_score_start, health_score_end, score_change,
            summary_en, summary_hi, key_achievements, areas_of_concern,
            is_published, published_at)
           VALUES ('zone',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$14,$15,$16,$17,TRUE,NOW())
           ON CONFLICT DO NOTHING""",
        zone_name, week_start, week_end,
        total, resolved, pending,
        resolution_rate, avg_hours,
        stats["top_category"] or "other",
        json.dumps(category_breakdown),
        json.dumps(urgency_breakdown),
        score_end, score_end,
        summary_en, summary_hi, achievements, concerns,
    )
    logger.info(f"Zone digest: {zone_name} — {total} complaints, {resolution_rate}% resolved")


# ─────────────────────────────────────────────────────────────────────────────
# CITY-LEVEL DIGEST
# ─────────────────────────────────────────────────────────────────────────────

async def _generate_city_digest(pool, week_start: date, week_end: date):
    existing = await pool.fetchrow(
        "SELECT digest_id FROM weekly_digests WHERE digest_type='city' AND week_start=$1",
        week_start,
    )
    if existing:
        return

    ws_dt = _to_utc(week_start)
    we_dt = _to_utc(week_end) + timedelta(days=1)

    stats = await pool.fetchrow(
        """SELECT
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved,
               COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed')) AS pending,
               AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)
                   FILTER (WHERE resolved_at IS NOT NULL) AS avg_hours,
               mode() WITHIN GROUP (ORDER BY category) AS top_category,
               AVG(citizen_rating) FILTER (WHERE citizen_rating IS NOT NULL) AS avg_rating,
               COUNT(*) FILTER (WHERE sla_breached = TRUE) AS breach_count
           FROM complaints
           WHERE created_at >= $1 AND created_at < $2""",
        ws_dt, we_dt,
    )

    city_health = await pool.fetchval(
        "SELECT ROUND(AVG(health_score)::decimal, 2) FROM wards"
    ) or 50

    cat_rows = await pool.fetch(
        """SELECT category, COUNT(*) AS count
           FROM complaints
           WHERE created_at >= $1 AND created_at < $2 AND category IS NOT NULL
           GROUP BY category ORDER BY count DESC""",
        ws_dt, we_dt,
    )

    urg_rows = await pool.fetch(
        """SELECT urgency, COUNT(*) AS count
           FROM complaints
           WHERE created_at >= $1 AND created_at < $2
           GROUP BY urgency ORDER BY count DESC""",
        ws_dt, we_dt,
    )

    # Zone breakdown for city digest (bonus)
    zone_rows = await pool.fetch(
        """SELECT w.zone,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE c.status IN ('resolved','closed')) AS resolved
           FROM complaints c JOIN wards w ON c.ward_id = w.ward_id
           WHERE c.created_at >= $1 AND c.created_at < $2
           GROUP BY w.zone ORDER BY total DESC""",
        ws_dt, we_dt,
    )

    total           = int(stats["total"] or 0)
    resolved        = int(stats["resolved"] or 0)
    pending         = int(stats["pending"] or 0)
    resolution_rate = round((resolved / max(total, 1)) * 100, 1)
    avg_hours       = round(float(stats["avg_hours"] or 0), 1)
    score_end       = float(city_health)

    category_breakdown = [{"category": r["category"], "count": r["count"]} for r in cat_rows]
    urgency_breakdown  = [{"urgency":  r["urgency"],  "count": r["count"]} for r in urg_rows]
    # Stash zone breakdown inside category_breakdown as extra field for city
    zone_breakdown     = [{"zone": r["zone"], "total": r["total"], "resolved": r["resolved"]} for r in zone_rows]

    digest_stats = {
        "total": total, "resolved": resolved, "resolution_rate": resolution_rate,
        "avg_hours": avg_hours, "top_category": stats["top_category"] or "N/A",
        "avg_rating": float(stats["avg_rating"] or 0),
        "breach_count": int(stats["breach_count"] or 0),
        "score_start": score_end, "score_end": score_end,
        "overdue": int(stats["breach_count"] or 0),
    }

    summary_en = await generate_weekly_digest("MCD Delhi (Full City)", digest_stats)
    summary_hi = await _safe_translate(summary_en)

    achievements, concerns = _build_achievements_concerns(
        resolution_rate, avg_hours, score_end, score_end,
        stats["breach_count"], total
    )

    await pool.execute(
        """INSERT INTO weekly_digests
           (digest_type, week_start, week_end,
            total_complaints, resolved_complaints, pending_complaints,
            resolution_rate, avg_resolution_hours, top_category,
            category_breakdown, urgency_breakdown,
            health_score_start, health_score_end, score_change,
            summary_en, summary_hi, key_achievements, areas_of_concern,
            is_published, published_at)
           VALUES ('city',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,$13,$14,$15,$16,TRUE,NOW())
           ON CONFLICT DO NOTHING""",
        week_start, week_end,
        total, resolved, pending,
        resolution_rate, avg_hours,
        stats["top_category"] or "other",
        json.dumps(category_breakdown),
        json.dumps(urgency_breakdown),
        score_end, score_end,
        summary_en, summary_hi, achievements, concerns,
    )
    logger.info(f"City digest: {total} complaints city-wide, {resolution_rate}% resolved")


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _to_utc(d: date) -> datetime:
    """Convert a date to a timezone-aware midnight UTC datetime."""
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


async def _get_health_score_range(pool, ward_id: int,
                                   ws_dt: datetime, we_dt: datetime) -> tuple[float, float]:
    row = await pool.fetchrow(
        """SELECT
               (SELECT composite_score FROM ward_health_scores
                WHERE ward_id=$1 AND calculated_at >= $2
                ORDER BY calculated_at ASC LIMIT 1) AS score_start,
               (SELECT composite_score FROM ward_health_scores
                WHERE ward_id=$1 AND calculated_at < $3
                ORDER BY calculated_at DESC LIMIT 1) AS score_end""",
        ward_id, ws_dt, we_dt,
    )
    score_start = float(row["score_start"] or 50)
    score_end   = float(row["score_end"]   or 50)
    return score_start, score_end


async def _safe_translate(text: str) -> str:
    try:
        return await translate_single(text, "hi", "en")
    except Exception:
        return ""


def _build_achievements_concerns(
    resolution_rate: float, avg_hours: float,
    score_start: float, score_end: float,
    breach_count, total: int
) -> tuple[list, list]:
    achievements, concerns = [], []

    if resolution_rate >= 80:
        achievements.append(f"Excellent resolution rate of {resolution_rate:.0f}%")
    elif resolution_rate >= 60:
        achievements.append(f"Good resolution rate of {resolution_rate:.0f}%")

    if 0 < avg_hours < 24:
        achievements.append(f"Fast avg resolution time: {avg_hours:.0f} hours")

    if score_end > score_start + 2:
        achievements.append(f"Health improved by {score_end - score_start:.1f} points")

    if not achievements:
        achievements.append("Civic operations maintained this week")

    breaches = int(breach_count or 0)
    if breaches > 0:
        concerns.append(f"{breaches} SLA {'breach' if breaches == 1 else 'breaches'} this week")
    if resolution_rate < 60:
        concerns.append(f"Low resolution rate: {resolution_rate:.0f}%")
    if total > 50:
        concerns.append(f"High complaint volume: {total} received")
    if avg_hours > 72:
        concerns.append(f"Slow avg resolution time: {avg_hours:.0f} hours")

    if not concerns:
        concerns.append("No major concerns this week")

    return achievements, concerns