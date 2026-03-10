# """
# Ward Health Score Calculator.
# Runs every hour via APScheduler. Also triggered on every complaint status change.
# """
# import logging
# from datetime import datetime, timezone

# logger = logging.getLogger(__name__)

# GRADE_THRESHOLDS = [(80, "A"), (65, "B"), (50, "C"), (35, "D"), (0, "F")]


# def compute_score(stats: dict) -> tuple[float, str]:
#     total = max(stats.get("total_30d", 1), 1)
#     resolved = stats.get("resolved_30d", 0)
#     breaches = stats.get("breaches_30d", 0)
#     overdue = stats.get("currently_overdue", 0)
#     open_count = max(stats.get("total_open", 1), 1)
#     # ⬇️ FIX: Explicitly cast the Decimal from PostgreSQL to a Python float
#     avg_rating = float(stats.get("avg_rating") or 3.0) 
#     repeats = stats.get("repeats_30d", 0)

#     c1 = (resolved / total) * 100
#     c2 = max(0, (1 - breaches / max(resolved, 1))) * 100
#     c3 = (1 - min(overdue / open_count, 1)) * 100
#     c4 = ((avg_rating - 1) / 4) * 100
#     c5 = (1 - min(repeats / total, 1)) * 100

#     score = round(c1 * 0.30 + c2 * 0.25 + c3 * 0.20 + c4 * 0.15 + c5 * 0.10, 2)

#     for threshold, grade in GRADE_THRESHOLDS:
#         if score >= threshold:
#             return score, grade
#     return score, "F"


# async def recalculate_ward_health(pool, ward_id: int):
#     """Recalculate and persist health score for one ward."""
#     stats = await pool.fetchrow(
#         """
#         SELECT
#             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS total_30d,
#             COUNT(*) FILTER (WHERE status IN ('resolved','closed') AND created_at >= NOW() - INTERVAL '30 days') AS resolved_30d,
#             COUNT(*) FILTER (WHERE sla_breached = TRUE AND created_at >= NOW() - INTERVAL '30 days') AS breaches_30d,
#             COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed') AND sla_deadline < NOW()) AS currently_overdue,
#             COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed')) AS total_open,
#             AVG(citizen_rating) FILTER (WHERE citizen_rating IS NOT NULL) AS avg_rating,
#             COUNT(*) FILTER (WHERE is_duplicate = TRUE AND created_at >= NOW() - INTERVAL '30 days') AS repeats_30d
#         FROM complaints WHERE ward_id = $1
#         """,
#         ward_id,
#     )

#     score, grade = compute_score(dict(stats))

#     # Get 7-day-ago score for trend
#     old = await pool.fetchval(
#         """SELECT composite_score FROM ward_health_scores
#            WHERE ward_id = $1 AND calculated_at <= NOW() - INTERVAL '7 days'
#            ORDER BY calculated_at DESC LIMIT 1""",
#         ward_id,
#     )
#     delta = round(score - float(old or score), 2)
#     trend = "improving" if delta > 2 else ("declining" if delta < -2 else "stable")

#     # Insert snapshot
#     await pool.execute(
#         """INSERT INTO ward_health_scores
#            (ward_id, calculated_at, resolution_rate, overdue_count,
#             composite_score, grade, trend, score_delta_7d,
#             total_complaints, resolved_complaints, overdue_complaints, avg_rating)
#            VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)""",
#         ward_id,
#         round((stats["resolved_30d"] or 0) / max(stats["total_30d"] or 1, 1) * 100, 2),
#         stats["currently_overdue"] or 0,
#         score, grade, trend, delta,
#         stats["total_30d"] or 0,
#         stats["resolved_30d"] or 0,
#         stats["currently_overdue"] or 0,
#         float(stats["avg_rating"] or 0),
#     )

#     # Update wards table live score
#     await pool.execute(
#         "UPDATE wards SET health_score=$1, health_grade=$2, health_updated_at=NOW() WHERE ward_id=$3",
#         score, grade, ward_id,
#     )
#     logger.info(f"Ward {ward_id} health: {score:.1f} ({grade})")
#     return score, grade


# async def recalculate_all_wards(pool):
#     """Full city recalculation — runs hourly."""
#     wards = await pool.fetch("SELECT ward_id FROM wards ORDER BY ward_id")
#     for row in wards:
#         try:
#             await recalculate_ward_health(pool, row["ward_id"])
#         except Exception as e:
#             logger.error(f"Health calc failed for ward {row['ward_id']}: {e}")
#     logger.info("All ward health scores updated.")
"""
Ward Health Score Calculator.
Runs every hour via APScheduler. Also triggered on every complaint status change.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

GRADE_THRESHOLDS = [(80, "A"), (65, "B"), (50, "C"), (35, "D"), (0, "F")]


def compute_score(stats: dict) -> tuple[float, str]:
    total = max(stats.get("total_30d", 1), 1)
    resolved = stats.get("resolved_30d", 0)
    breaches = stats.get("breaches_30d", 0)
    overdue = stats.get("currently_overdue", 0)
    open_count = max(stats.get("total_open", 1), 1)
    avg_rating = float(stats.get("avg_rating") or 3.0)
    repeats = stats.get("repeats_30d", 0)

    c1 = (resolved / total) * 100
    c2 = max(0, (1 - breaches / max(resolved, 1))) * 100
    c3 = (1 - min(overdue / open_count, 1)) * 100
    c4 = ((avg_rating - 1) / 4) * 100
    c5 = (1 - min(repeats / total, 1)) * 100

    score = round(c1 * 0.30 + c2 * 0.25 + c3 * 0.20 + c4 * 0.15 + c5 * 0.10, 2)

    for threshold, grade in GRADE_THRESHOLDS:
        if score >= threshold:
            return score, grade
    return score, "F"


async def recalculate_ward_health(pool, ward_id: int):
    """Recalculate and persist health score for one ward."""
    stats = await pool.fetchrow(
        """
        SELECT
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS total_30d,
            COUNT(*) FILTER (WHERE status IN ('resolved','closed') AND created_at >= NOW() - INTERVAL '30 days') AS resolved_30d,
            COUNT(*) FILTER (WHERE sla_breached = TRUE AND created_at >= NOW() - INTERVAL '30 days') AS breaches_30d,
            COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed') AND sla_deadline < NOW()) AS currently_overdue,
            COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed')) AS total_open,
            AVG(citizen_rating) FILTER (WHERE citizen_rating IS NOT NULL) AS avg_rating,
            0 AS repeats_30d
        FROM complaints WHERE ward_id = $1
        """,
        ward_id,
    )

    score, grade = compute_score(dict(stats))

    # Get 7-day-ago score for trend
    old = await pool.fetchval(
        """SELECT composite_score FROM ward_health_scores
           WHERE ward_id = $1 AND calculated_at <= NOW() - INTERVAL '7 days'
           ORDER BY calculated_at DESC LIMIT 1""",
        ward_id,
    )
    delta = round(score - float(old or score), 2)
    trend = "improving" if delta > 2 else ("declining" if delta < -2 else "stable")

    # Insert snapshot
    await pool.execute(
        """INSERT INTO ward_health_scores
           (ward_id, calculated_at, resolution_rate, overdue_count,
            composite_score, grade, trend, score_delta_7d,
            total_complaints, resolved_complaints, overdue_complaints, avg_rating)
           VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)""",
        ward_id,
        round((stats["resolved_30d"] or 0) / max(stats["total_30d"] or 1, 1) * 100, 2),
        stats["currently_overdue"] or 0,
        score, grade, trend, delta,
        stats["total_30d"] or 0,
        stats["resolved_30d"] or 0,
        stats["currently_overdue"] or 0,
        float(stats["avg_rating"] or 0),
    )

    # Update wards table live score
    await pool.execute(
        "UPDATE wards SET health_score=$1, health_grade=$2, health_updated_at=NOW() WHERE ward_id=$3",
        score, grade, ward_id,
    )
    logger.info(f"Ward {ward_id} health: {score:.1f} ({grade})")
    return score, grade


async def recalculate_all_wards(pool):
    """Full city recalculation — runs hourly."""
    wards = await pool.fetch("SELECT ward_id FROM wards ORDER BY ward_id")
    for row in wards:
        try:
            await recalculate_ward_health(pool, row["ward_id"])
        except Exception as e:
            logger.error(f"Health calc failed for ward {row['ward_id']}: {e}")
    logger.info("All ward health scores updated.")