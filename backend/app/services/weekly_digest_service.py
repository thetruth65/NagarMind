"""
Agent 5: Weekly Digest Generator
Runs every Sunday 11 PM via APScheduler.
Generates Gemini digest for all 272 wards, translates to Hindi via Sarvam.
"""
import logging
from datetime import datetime, timedelta, date, timezone
from app.services.gemini_service import generate_weekly_digest
from app.services.sarvam_service import translate_single

logger = logging.getLogger(__name__)


async def generate_all_ward_digests(pool):
    """Generate weekly digest for every ward. Called Sunday 11 PM."""
    now = datetime.now(timezone.utc)
    week_end = now.date()
    week_start = week_end - timedelta(days=7)

    wards = await pool.fetch("SELECT ward_id, ward_name FROM wards ORDER BY ward_id")
    generated = 0

    for ward in wards:
        try:
            await _generate_ward_digest(pool, ward["ward_id"], ward["ward_name"],
                                        week_start, week_end)
            generated += 1
        except Exception as e:
            logger.error(f"Digest failed for ward {ward['ward_id']}: {e}")

    logger.info(f"Weekly digests generated: {generated}/{len(wards)} wards")
    return generated


async def _generate_ward_digest(pool, ward_id: int, ward_name: str,
                                 week_start: date, week_end: date):
    # Check already generated this week
    existing = await pool.fetchrow(
        "SELECT digest_id FROM weekly_digests WHERE ward_id=$1 AND week_start=$2",
        ward_id, week_start,
    )
    if existing:
        return

    # Gather stats for this ward this week
    stats = await pool.fetchrow(
        """SELECT
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved,
               AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)
                   FILTER (WHERE resolved_at IS NOT NULL) AS avg_hours,
               mode() WITHIN GROUP (ORDER BY category) AS top_category,
               AVG(citizen_rating) FILTER (WHERE citizen_rating IS NOT NULL) AS avg_rating,
               COUNT(*) FILTER (WHERE sla_breached = TRUE) AS breach_count
           FROM complaints
           WHERE ward_id = $1
             AND created_at >= $2 AND created_at < $3""",
        ward_id,
        datetime.combine(week_start, datetime.min.time()),
        datetime.combine(week_end, datetime.min.time()),
    )

    total = int(stats["total"] or 0)
    resolved = int(stats["resolved"] or 0)
    resolution_rate = round((resolved / max(total, 1)) * 100, 1)
    avg_hours = round(float(stats["avg_hours"] or 0), 1)
    avg_rating = round(float(stats["avg_rating"] or 0), 2)

    # Health score at start and end of week
    score_row = await pool.fetchrow(
        """SELECT
               (SELECT composite_score FROM ward_health_scores
                WHERE ward_id=$1 AND calculated_at >= $2 ORDER BY calculated_at ASC LIMIT 1) AS score_start,
               (SELECT composite_score FROM ward_health_scores
                WHERE ward_id=$1 AND calculated_at <= $3 ORDER BY calculated_at DESC LIMIT 1) AS score_end""",
        ward_id,
        datetime.combine(week_start, datetime.min.time()),
        datetime.combine(week_end, datetime.max.time()),
    )
    score_start = float(score_row["score_start"] or 50)
    score_end = float(score_row["score_end"] or 50)

    digest_stats = {
        "total": total, "resolved": resolved,
        "resolution_rate": resolution_rate, "avg_hours": avg_hours,
        "top_category": stats["top_category"] or "N/A",
        "avg_rating": avg_rating, "breach_count": int(stats["breach_count"] or 0),
        "score_start": score_start, "score_end": score_end,
    }

    # Generate English narrative via Gemini
    summary_en = await generate_weekly_digest(ward_name, digest_stats)

    # Translate to Hindi via Sarvam
    summary_hi = await translate_single(summary_en, "hi", "en")

    # Build achievements and concerns from data
    achievements = []
    concerns = []

    if resolution_rate >= 80:
        achievements.append(f"Excellent resolution rate of {resolution_rate}%")
    if avg_hours > 0 and avg_hours < 24:
        achievements.append(f"Fast average resolution time of {avg_hours:.0f} hours")
    if score_end > score_start:
        achievements.append(f"Ward health improved by {score_end - score_start:.1f} points")

    if stats["breach_count"] and int(stats["breach_count"]) > 0:
        concerns.append(f"{stats['breach_count']} SLA breaches this week")
    if resolution_rate < 60:
        concerns.append(f"Low resolution rate of {resolution_rate}%")
    if total > 50:
        concerns.append(f"High complaint volume: {total} complaints received")

    await pool.execute(
        """INSERT INTO weekly_digests
           (ward_id, week_start, week_end, total_complaints, resolved_complaints,
            resolution_rate, avg_resolution_hours, top_category,
            health_score_start, health_score_end, score_change,
            summary_en, summary_hi, key_achievements, areas_of_concern,
            is_published, published_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,TRUE,NOW())
           ON CONFLICT (ward_id, week_start) DO UPDATE SET
               summary_en=EXCLUDED.summary_en, summary_hi=EXCLUDED.summary_hi,
               is_published=TRUE, published_at=NOW()""",
        ward_id, week_start, week_end, total, resolved,
        resolution_rate, avg_hours,
        stats["top_category"] or "other",
        score_start, score_end, round(score_end - score_start, 2),
        summary_en, summary_hi,
        achievements or ["No notable achievements this week"],
        concerns or ["No major concerns this week"],
    )
    logger.info(f"Digest generated: Ward {ward_id} ({ward_name}): {total} complaints, {resolution_rate}% resolved")