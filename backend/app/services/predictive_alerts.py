"""
Agent 6: Predictive Alert Engine
Runs hourly. Detects: flood risk, pothole clusters, sanitation breakdown,
officer overload, SLA cascade. Generates Gemini narrative per alert.
"""
import logging
import json
from datetime import datetime, timezone
from uuid import uuid4
from app.services.gemini_service import gemini_generate

logger = logging.getLogger(__name__)

ALERT_TYPES = {
    "flood_risk":          "🌊 Flood Risk",
    "pothole_cluster":     "🕳️ Pothole Cluster",
    "sanitation_crisis":   "🗑️ Sanitation Breakdown",
    "officer_overload":    "👷 Officer Overload",
    "sla_cascade":         "⏱️ SLA Cascade",
    "repeat_hotspot":      "🔁 Repeat Hotspot",
}


async def _generate_alert_narrative(alert_type: str, evidence: dict) -> str:
    prompt = f"""You are a smart civic alert system for MCD Delhi.
Generate a 3-sentence alert notification. Be specific, urgent, and actionable.
Alert type: {alert_type}
Evidence: {json.dumps(evidence, default=str)}
Format: [What's happening]. [Why it's a concern]. [Recommended immediate action].
Max 80 words."""
    try:
        return await gemini_generate(prompt)
    except Exception:
        return f"Alert: {alert_type} detected in ward. Immediate inspection recommended."


async def run_predictive_alerts(pool):
    """Full predictive alert scan across all wards."""
    alerts_created = 0

    # 1. Flood risk — >5 sewage complaints in same ward within 6 hours
    # v7: removed location_hash, location_address — group by ward only
    flood_rows = await pool.fetch(
        """SELECT ward_id, COUNT(*) AS complaint_count,
                  array_agg(address) FILTER (WHERE address IS NOT NULL) AS addresses
           FROM complaints
           WHERE category = 'sewage'
             AND created_at >= NOW() - INTERVAL '6 hours'
             AND status != 'resolved'
           GROUP BY ward_id
           HAVING COUNT(*) >= 5""",
    )
    for row in flood_rows:
        evidence = {
            "complaint_count": row["complaint_count"],
            "sample_address": (row["addresses"] or ["Unknown"])[0],
        }
        narrative = await _generate_alert_narrative("flood_risk", evidence)
        await _upsert_alert(pool, row["ward_id"], "flood_risk", "critical", narrative, evidence)
        alerts_created += 1

    # 2. Pothole cluster — >3 potholes in same ward in 48h
    # v7: removed location_hash — group by ward_id only
    pothole_rows = await pool.fetch(
        """SELECT ward_id, COUNT(*) AS count
           FROM complaints
           WHERE category = 'pothole'
             AND created_at >= NOW() - INTERVAL '48 hours'
           GROUP BY ward_id
           HAVING COUNT(*) >= 3""",
    )
    for row in pothole_rows:
        evidence = {"count": row["count"], "ward_id": row["ward_id"]}
        narrative = await _generate_alert_narrative("pothole_cluster", evidence)
        await _upsert_alert(pool, row["ward_id"], "pothole_cluster", "high", narrative, evidence)
        alerts_created += 1

    # 3. Sanitation breakdown — >10 garbage complaints in 24h
    sanit_rows = await pool.fetch(
        """SELECT ward_id, COUNT(*) AS count
           FROM complaints
           WHERE category = 'garbage'
             AND created_at >= NOW() - INTERVAL '24 hours'
             AND status != 'resolved'
           GROUP BY ward_id
           HAVING COUNT(*) >= 10""",
    )
    for row in sanit_rows:
        evidence = {"unresolved_garbage_24h": row["count"]}
        narrative = await _generate_alert_narrative("sanitation_crisis", evidence)
        await _upsert_alert(pool, row["ward_id"], "sanitation_crisis", "high", narrative, evidence)
        alerts_created += 1

    # 4. Officer overload — officer with >20 open complaints
    # v7: full_name → name, assigned_officer_id → officer_id
    overload_rows = await pool.fetch(
        """SELECT o.officer_id, o.name AS officer_name, o.ward_id,
                  COUNT(c.complaint_id) AS open_count
           FROM officers o
           JOIN complaints c ON c.officer_id = o.officer_id
           WHERE c.status NOT IN ('resolved', 'closed')
           GROUP BY o.officer_id, o.name, o.ward_id
           HAVING COUNT(c.complaint_id) >= 20""",
    )
    for row in overload_rows:
        if not row["ward_id"]:
            continue
        evidence = {"officer_name": row["officer_name"], "open_count": row["open_count"]}
        narrative = await _generate_alert_narrative("officer_overload", evidence)
        await _upsert_alert(pool, row["ward_id"], "officer_overload", "medium", narrative, evidence)
        alerts_created += 1

    # 5. SLA cascade — >5 SLA breaches in same ward in 48h
    # v7: removed department column — group by ward only
    cascade_rows = await pool.fetch(
        """SELECT ward_id, COUNT(*) AS breach_count
           FROM complaints
           WHERE sla_breached = TRUE
             AND created_at >= NOW() - INTERVAL '48 hours'
           GROUP BY ward_id
           HAVING COUNT(*) >= 5""",
    )
    for row in cascade_rows:
        evidence = {"breaches_48h": row["breach_count"], "ward_id": row["ward_id"]}
        narrative = await _generate_alert_narrative("sla_cascade", evidence)
        await _upsert_alert(pool, row["ward_id"], "sla_cascade", "high", narrative, evidence)
        alerts_created += 1

    logger.info(f"Predictive alerts: {alerts_created} alerts generated/updated")
    return alerts_created


async def _upsert_alert(pool, ward_id: int, alert_type: str, severity: str,
                        narrative: str, evidence: dict):
    """Insert or update alert (deduplicate by ward+type in last 24h).
    v7: is_resolved → is_active (TRUE = active), narrative → description
    """
    existing = await pool.fetchrow(
        """SELECT alert_id FROM predictive_alerts
           WHERE ward_id = $1 AND alert_type = $2
             AND created_at >= NOW() - INTERVAL '24 hours'
             AND is_active = TRUE
           LIMIT 1""",
        ward_id, alert_type,
    )
    if existing:
        await pool.execute(
            """UPDATE predictive_alerts
               SET description = $1, evidence = $2, updated_at = NOW()
               WHERE alert_id = $3""",
            narrative, json.dumps(evidence), existing["alert_id"],
        )
    else:
        await pool.execute(
            """INSERT INTO predictive_alerts
               (alert_id, ward_id, alert_type, severity, title, description, evidence, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)""",
            str(uuid4()), ward_id, alert_type, severity,
            ALERT_TYPES.get(alert_type, alert_type),
            narrative, json.dumps(evidence),
        )