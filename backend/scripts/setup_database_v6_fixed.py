# """
# NagarMind — Complete Database Setup & Seed Script (v7)
# =======================================================

# WHAT THIS SCRIPT DOES:
#   1. Drops and recreates ALL tables with correct schema
#   2. Seeds 272 Delhi wards across 10 zones
#   3. Seeds 2 admins + 544 officers (2 per ward) with phones
#   4. Seeds 2720 citizens (10 per ward) with full profiles
#   5. Seeds 2720+ complaints (correct category keys, multi-status, multi-week spread)
#   6. Seeds complaint_status_history (full pipeline: submitted→assigned→acknowledged→in_progress→resolved)
#   7. Seeds notifications for officers AND citizens (inbox populated)
#   8. Seeds ward_health_scores (weekly, 12 weeks back)
#   9. Seeds weekly_digests:
#        - ward level:  ALL 272 wards × 12 weeks (past) + current running week
#        - zone level:  10 zones × 12 weeks + current week
#        - city level:  13 weeks total
#   10. Seeds complaint_messages (officer↔citizen communication per complaint)

# CATEGORIES (matching complaint_pipeline.py SLA_TABLE):
#   pothole, garbage, sewage, water_supply, streetlight,
#   tree, stray_animals, encroachment, noise, other

# URGENCY LEVELS: critical, high, medium, low
# STATUS PIPELINE: submitted → assigned → acknowledged → in_progress → resolved / closed

# RUN:
#   cd backend
#   python scripts/setup_database_v6_fixed.py
# """

# import asyncio
# import asyncpg
# import os
# import json
# import random
# import uuid
# import bcrypt
# from datetime import datetime, timedelta, date, timezone
# from dotenv import load_dotenv

# load_dotenv()
# DATABASE_URL = os.getenv("DATABASE_URL")

# # ─── Constants ────────────────────────────────────────────────────────────────

# CATEGORIES   = ["pothole", "garbage", "sewage", "water_supply", "streetlight",
#                 "tree", "stray_animals", "encroachment", "noise", "other"]

# URGENCY_LEVELS = ["critical", "high", "medium", "low"]
# URGENCY_WEIGHTS = [0.10, 0.25, 0.45, 0.20]

# SLA_HOURS = {
#     "pothole": 48, "garbage": 24, "sewage": 12, "water_supply": 24,
#     "streetlight": 72, "tree": 96, "stray_animals": 48,
#     "encroachment": 120, "noise": 24, "other": 72,
# }

# STATUS_PIPELINE  = ["submitted", "assigned", "acknowledged", "in_progress", "resolved"]
# STATUS_TERMINAL  = {"resolved", "closed"}

# ZONES = [
#     "Central", "City SP", "Civil Lines", "Keshavpuram",
#     "Najafgarh", "Narela", "Rohini", "Sadar Paharganj",
#     "Shahdara North", "Shahdara South",
# ]

# # ─── Delhi Ward Data (272 wards across 10 zones) ─────────────────────────────

# def generate_wards():
#     wards = []
#     ward_id = 1
#     counts = {
#         "Central": 26, "City SP": 28, "Civil Lines": 29, "Keshavpuram": 28,
#         "Najafgarh": 28, "Narela": 28, "Rohini": 30, "Sadar Paharganj": 26,
#         "Shahdara North": 35, "Shahdara South": 34,
#     }
#     ZONE_COORDS = {
#         "Central":         (28.6280, 77.2290),
#         "City SP":         (28.6550, 77.2300),
#         "Civil Lines":     (28.6870, 77.2230),
#         "Keshavpuram":     (28.6930, 77.1560),
#         "Najafgarh":       (28.6090, 76.9800),
#         "Narela":          (28.8520, 77.0930),
#         "Rohini":          (28.7380, 77.1090),
#         "Sadar Paharganj": (28.6440, 77.1990),
#         "Shahdara North":  (28.7120, 77.2960),
#         "Shahdara South":  (28.6650, 77.3010),
#     }
#     grade_map = {(80,101):"A", (60,80):"B", (40,60):"C", (20,40):"D", (0,20):"F"}
#     for zone, count in counts.items():
#         base_lat, base_lng = ZONE_COORDS[zone]
#         for i in range(1, count + 1):
#             health = round(random.uniform(35, 92), 2)
#             grade = next(g for (lo,hi),g in grade_map.items() if lo <= health < hi)
#             lat = round(base_lat + random.uniform(-0.08, 0.08), 6)
#             lng = round(base_lng + random.uniform(-0.08, 0.08), 6)
#             wards.append({
#                 "ward_id":      ward_id,
#                 "ward_name":    f"Ward {ward_id} - {zone}",
#                 "zone":         zone,
#                 "health_score": health,
#                 "health_grade": grade,
#                 "lat_center":   lat,
#                 "lng_center":   lng,
#             })
#             ward_id += 1
#     return wards

# # ─── Schema DDL ───────────────────────────────────────────────────────────────

# SCHEMA_SQL = """
# CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
# CREATE EXTENSION IF NOT EXISTS "pgcrypto";

# -- WARDS
# CREATE TABLE wards (
#     ward_id       INTEGER PRIMARY KEY,
#     ward_name     TEXT    NOT NULL,
#     zone          TEXT    NOT NULL,
#     health_score  DECIMAL(5,2) DEFAULT 50,
#     health_grade  TEXT    DEFAULT 'C',
#     lat_center    DECIMAL(10,6),
#     lng_center    DECIMAL(10,6),
#     created_at    TIMESTAMPTZ  DEFAULT NOW()
# );

# -- ADMINS
# CREATE TABLE admins (
#     admin_id      UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
#     employee_id   TEXT    UNIQUE NOT NULL,
#     name          TEXT    NOT NULL,
#     email         TEXT    UNIQUE NOT NULL,
#     phone_number  TEXT,
#     password_hash TEXT    NOT NULL,
#     role          TEXT    DEFAULT 'admin',
#     is_active     BOOLEAN DEFAULT TRUE,
#     created_at    TIMESTAMPTZ DEFAULT NOW()
# );

# -- OFFICERS
# CREATE TABLE officers (
#     officer_id    UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
#     employee_id   TEXT    UNIQUE NOT NULL,
#     name          TEXT    NOT NULL,
#     email         TEXT    UNIQUE NOT NULL,
#     phone_number  TEXT,
#     ward_id       INTEGER REFERENCES wards(ward_id),
#     designation   TEXT    DEFAULT 'Field Officer',
#     is_active     BOOLEAN DEFAULT TRUE,
#     password_hash TEXT    NOT NULL,
#     created_at    TIMESTAMPTZ DEFAULT NOW()
# );

# -- CITIZENS
# CREATE TABLE citizens (
#     citizen_id    UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
#     name          TEXT    NOT NULL,
#     email         TEXT    UNIQUE NOT NULL,
#     phone_number  TEXT    UNIQUE NOT NULL,
#     ward_id       INTEGER REFERENCES wards(ward_id),
#     address       TEXT,
#     password_hash TEXT    NOT NULL,
#     is_active     BOOLEAN DEFAULT TRUE,
#     created_at    TIMESTAMPTZ DEFAULT NOW()
# );

# -- COMPLAINTS
# CREATE TABLE complaints (
#     complaint_id     UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
#     citizen_id       UUID    REFERENCES citizens(citizen_id),
#     ward_id          INTEGER REFERENCES wards(ward_id),
#     officer_id       UUID    REFERENCES officers(officer_id),
#     category         TEXT,
#     subcategory      TEXT,
#     title            TEXT    NOT NULL,
#     description      TEXT    NOT NULL,
#     status           TEXT    DEFAULT 'submitted',
#     urgency          TEXT    DEFAULT 'medium',
#     latitude         DECIMAL(10,6),
#     longitude        DECIMAL(10,6),
#     address          TEXT,
#     photo_urls       TEXT[]  DEFAULT '{}',
#     voice_transcript TEXT,
#     ai_summary       TEXT,
#     sla_hours        INTEGER DEFAULT 72,
#     sla_deadline     TIMESTAMPTZ,
#     sla_breached     BOOLEAN DEFAULT FALSE,
#     resolved_at      TIMESTAMPTZ,
#     citizen_rating   INTEGER,
#     citizen_feedback TEXT,
#     submitted_at     TIMESTAMPTZ DEFAULT NOW(),
#     created_at       TIMESTAMPTZ DEFAULT NOW(),
#     updated_at       TIMESTAMPTZ DEFAULT NOW()
# );

# -- COMPLAINT STATUS HISTORY
# CREATE TABLE complaint_status_history (
#     history_id   UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
#     complaint_id UUID    REFERENCES complaints(complaint_id) ON DELETE CASCADE,
#     changed_by   UUID,
#     changed_by_role TEXT,
#     old_status   TEXT,
#     new_status   TEXT    NOT NULL,
#     notes        TEXT,
#     created_at   TIMESTAMPTZ DEFAULT NOW()
# );

# -- COMPLAINT MESSAGES (Officer ↔ Citizen communication)
# CREATE TABLE complaint_messages (
#     message_id   UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
#     complaint_id UUID    REFERENCES complaints(complaint_id) ON DELETE CASCADE,
#     sender_id    UUID    NOT NULL,
#     sender_role  TEXT    NOT NULL,  -- 'citizen' | 'officer' | 'admin'
#     sender_name  TEXT,
#     message_text TEXT    NOT NULL,
#     is_read      BOOLEAN DEFAULT FALSE,
#     created_at   TIMESTAMPTZ DEFAULT NOW()
# );

# -- NOTIFICATIONS
# CREATE TABLE notifications (
#     notification_id UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
#     user_id         UUID    NOT NULL,
#     user_role       TEXT    NOT NULL,  -- 'citizen' | 'officer' | 'admin'
#     complaint_id    UUID    REFERENCES complaints(complaint_id) ON DELETE SET NULL,
#     title           TEXT    NOT NULL,
#     body            TEXT    NOT NULL,
#     type            TEXT    DEFAULT 'status_update',
#     is_read         BOOLEAN DEFAULT FALSE,
#     created_at      TIMESTAMPTZ DEFAULT NOW()
# );

# -- WARD HEALTH SCORES (historical)
# CREATE TABLE ward_health_scores (
#     score_id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
#     ward_id          INTEGER REFERENCES wards(ward_id),
#     composite_score  DECIMAL(5,2) NOT NULL,
#     resolution_rate  DECIMAL(5,2),
#     avg_response_hrs DECIMAL(8,2),
#     sla_breach_rate  DECIMAL(5,2),
#     calculated_at    TIMESTAMPTZ DEFAULT NOW()
# );

# -- WEEKLY DIGESTS
# CREATE TABLE weekly_digests (
#     digest_id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
#     digest_type          TEXT    NOT NULL DEFAULT 'ward',  -- 'ward' | 'zone' | 'city'
#     ward_id              INTEGER REFERENCES wards(ward_id),
#     zone_name            TEXT,
#     week_start           DATE    NOT NULL,
#     week_end             DATE    NOT NULL,
#     total_complaints     INTEGER DEFAULT 0,
#     resolved_complaints  INTEGER DEFAULT 0,
#     pending_complaints   INTEGER DEFAULT 0,
#     resolution_rate      DECIMAL(5,2) DEFAULT 0,
#     avg_resolution_hours DECIMAL(8,2) DEFAULT 0,
#     top_category         TEXT,
#     category_breakdown   JSONB,
#     urgency_breakdown    JSONB,
#     health_score_start   DECIMAL(5,2) DEFAULT 50,
#     health_score_end     DECIMAL(5,2) DEFAULT 50,
#     score_change         DECIMAL(5,2) DEFAULT 0,
#     summary_en           TEXT,
#     summary_hi           TEXT,
#     key_achievements     TEXT[]  DEFAULT '{}',
#     areas_of_concern     TEXT[]  DEFAULT '{}',
#     is_published         BOOLEAN DEFAULT FALSE,
#     published_at         TIMESTAMPTZ,
#     created_at           TIMESTAMPTZ DEFAULT NOW(),
#     UNIQUE (ward_id, week_start)
# );

# -- PREDICTIVE ALERTS
# CREATE TABLE predictive_alerts (
#     alert_id      UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
#     ward_id       INTEGER REFERENCES wards(ward_id),
#     alert_type    TEXT    NOT NULL,
#     severity      TEXT    DEFAULT 'medium',
#     title         TEXT    NOT NULL,
#     description   TEXT,
#     evidence      JSONB   DEFAULT '{}',
#     is_active     BOOLEAN DEFAULT TRUE,
#     created_at    TIMESTAMPTZ DEFAULT NOW(),
#     expires_at    TIMESTAMPTZ
# );
# """

# # ─── Helpers ──────────────────────────────────────────────────────────────────

# def hash_password(pw: str) -> str:
#     return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

# def utc(d: date) -> datetime:
#     return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)

# def rand_dt(start: datetime, end: datetime) -> datetime:
#     delta = (end - start).total_seconds()
#     return start + timedelta(seconds=random.uniform(0, delta))

# TODAY = datetime.now(timezone.utc).date()

# def week_bounds(weeks_ago: int) -> tuple[date, date]:
#     """Return (week_start, week_end) for N weeks ago. week_end = week_start + 6 days."""
#     end   = TODAY - timedelta(days=7 * weeks_ago)
#     start = end   - timedelta(days=6)
#     return start, end

# def category_breakdown_json(complaints_subset):
#     from collections import Counter
#     counts = Counter(c["category"] for c in complaints_subset)
#     return json.dumps([{"category": k, "count": v} for k, v in counts.most_common()])

# def urgency_breakdown_json(complaints_subset):
#     from collections import Counter
#     counts = Counter(c["urgency"] for c in complaints_subset)
#     return json.dumps([{"urgency": k, "count": v} for k, v in counts.most_common()])

# def build_achievements_concerns(resolution_rate, avg_hours, score_start, score_end, breach_count, total):
#     achievements, concerns = [], []
#     if resolution_rate >= 80:
#         achievements.append(f"Excellent resolution rate of {resolution_rate:.0f}%")
#     elif resolution_rate >= 60:
#         achievements.append(f"Good resolution rate of {resolution_rate:.0f}%")
#     if 0 < avg_hours < 24:
#         achievements.append(f"Fast avg resolution: {avg_hours:.0f}h")
#     if score_end > score_start + 2:
#         achievements.append(f"Health score improved by {score_end - score_start:.1f} pts")
#     if not achievements:
#         achievements.append("Civic operations maintained this week")

#     if breach_count > 0:
#         concerns.append(f"{breach_count} SLA {'breach' if breach_count == 1 else 'breaches'} this week")
#     if resolution_rate < 60:
#         concerns.append(f"Low resolution rate: {resolution_rate:.0f}%")
#     if total > 50:
#         concerns.append(f"High complaint volume: {total} received")
#     if avg_hours > 72:
#         concerns.append(f"Slow resolution: {avg_hours:.0f}h avg")
#     if not concerns:
#         concerns.append("No major concerns this week")
#     return achievements, concerns

# # ─── Drop all tables ──────────────────────────────────────────────────────────

# async def drop_all_tables(pool):
#     async with pool.acquire() as conn:
#         await conn.execute("""
#             DROP TABLE IF EXISTS
#                 predictive_alerts, weekly_digests, ward_health_scores,
#                 complaint_messages, notifications, complaint_status_history,
#                 complaints, citizens, officers, admins, wards
#             CASCADE;
#             DROP TABLE IF EXISTS alembic_version CASCADE;
#         """)
#     print("✅ All tables dropped")

# # ─── Create schema ────────────────────────────────────────────────────────────

# async def create_schema(pool):
#     async with pool.acquire() as conn:
#         await conn.execute(SCHEMA_SQL)
#     print("✅ Schema created")

# # ─── Seed wards ──────────────────────────────────────────────────────────────

# async def seed_wards(pool):
#     wards = generate_wards()
#     async with pool.acquire() as conn:
#         await conn.executemany(
#             """INSERT INTO wards (ward_id, ward_name, zone, health_score, health_grade, lat_center, lng_center)
#                VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING""",
#             [(w["ward_id"], w["ward_name"], w["zone"], w["health_score"],
#               w["health_grade"], w["lat_center"], w["lng_center"]) for w in wards]
#         )
#     print(f"✅ {len(wards)} wards seeded")
#     return wards

# # ─── Seed admins ──────────────────────────────────────────────────────────────

# async def seed_admins(pool):
#     pw = hash_password("Admin@123!")
#     admins = [
#         ("MCD-ADMIN-001", "Rajesh Kumar Sharma",   "admin1@mcd.delhi.gov.in", "+919810001001", pw),
#         ("MCD-ADMIN-002", "Priya Malhotra",         "admin2@mcd.delhi.gov.in", "+919810001002", pw),
#     ]
#     async with pool.acquire() as conn:
#         await conn.executemany(
#             """INSERT INTO admins (employee_id, name, email, phone_number, password_hash)
#                VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING""",
#             admins
#         )
#     print(f"✅ {len(admins)} admins seeded")

# # ─── Seed officers (2 per ward) ───────────────────────────────────────────────

# async def seed_officers(pool, wards):
#     pw = hash_password("Officer@123!")
#     DESIGNATIONS = ["Junior Engineer", "Assistant Engineer", "Field Officer",
#                     "Sanitation Officer", "Health Inspector"]
#     officers = []
#     for w in wards:
#         wid = w["ward_id"]
#         for i in range(1, 3):
#             emp_id = f"OFF-{wid:03d}-{i}"
#             name   = f"Officer {wid}-{i}"
#             email  = f"officer{wid}_{i}@mcd.delhi.gov.in"
#             phone  = f"+9198{wid:04d}{i:03d}"[:13]  # keep E.164 safe
#             desig  = random.choice(DESIGNATIONS)
#             officers.append((emp_id, name, email, phone, wid, desig, pw))

#     async with pool.acquire() as conn:
#         await conn.executemany(
#             """INSERT INTO officers (employee_id, name, email, phone_number, ward_id, designation, password_hash)
#                VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING""",
#             officers
#         )
#     print(f"✅ {len(officers)} officers seeded")

#     # Return map ward_id → [officer_uuid, ...]
#     rows = await pool.fetch("SELECT officer_id, ward_id FROM officers ORDER BY ward_id, employee_id")
#     officer_map: dict[int, list] = {}
#     for r in rows:
#         officer_map.setdefault(r["ward_id"], []).append(r["officer_id"])
#     return officer_map

# # ─── Seed citizens (10 per ward) ─────────────────────────────────────────────

# async def seed_citizens(pool, wards):
#     pw = hash_password("TestPass@123")
#     FIRST = ["Amit","Priya","Rahul","Sunita","Vikram","Anjali","Rohit","Neha",
#              "Sanjay","Kavita","Arjun","Pooja","Deepak","Meera","Arun"]
#     LAST  = ["Sharma","Gupta","Singh","Verma","Kumar","Jain","Agarwal",
#              "Mishra","Yadav","Tiwari","Srivastava","Pandey"]
#     citizens = []
#     for w in wards:
#         wid = w["ward_id"]
#         for i in range(1, 11):
#             name  = f"{random.choice(FIRST)} {random.choice(LAST)}"
#             email = f"citizen{wid}_{i}@test.com"
#             phone = f"+9199{wid:04d}{i:03d}"[:13]
#             addr  = f"House {i}, {w['ward_name']}, {w['zone']} Zone, Delhi"
#             citizens.append((name, email, phone, wid, addr, pw))

#     async with pool.acquire() as conn:
#         await conn.executemany(
#             """INSERT INTO citizens (name, email, phone_number, ward_id, address, password_hash)
#                VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING""",
#             citizens
#         )
#     print(f"✅ {len(citizens)} citizens seeded")

#     rows = await pool.fetch("SELECT citizen_id, ward_id FROM citizens ORDER BY ward_id, email")
#     citizen_map: dict[int, list] = {}
#     for r in rows:
#         citizen_map.setdefault(r["ward_id"], []).append(r["citizen_id"])
#     return citizen_map

# # ─── Seed complaints (spread across 12 weeks + current week) ─────────────────

# COMPLAINT_TEMPLATES = {
#     "pothole":       ("Large Pothole on Main Road", "Deep pothole causing accidents near the junction."),
#     "garbage":       ("Uncollected Garbage Pile",   "Garbage not collected for several days, causing stench."),
#     "sewage":        ("Sewage Overflow on Street",  "Overflowing sewer blocking pedestrian path."),
#     "water_supply":  ("No Water Supply for Days",   "Water supply disrupted for residents of this area."),
#     "streetlight":   ("Street Lights Not Working",  "Multiple streetlights broken, area unsafe at night."),
#     "tree":          ("Fallen Tree Blocking Road",  "Large tree fell due to storm, blocking main road."),
#     "stray_animals": ("Aggressive Stray Dogs",      "Pack of stray dogs attacking pedestrians near park."),
#     "encroachment":  ("Illegal Encroachment",       "Shop owner has encroached footpath, blocking access."),
#     "noise":         ("Noise Pollution from Site",  "Construction site causing extreme noise past midnight."),
#     "other":         ("Civic Issue Reported",       "Miscellaneous civic issue affecting residents."),
# }

# async def seed_complaints(pool, wards, citizen_map, officer_map):
#     """
#     Seeds complaints spread over 13 weeks:
#       - Weeks 12..1 ago: 5 complaints per ward per week (historical)
#       - Week 0 (current running week): 2 complaints per ward
#     Each complaint has a realistic status progression.
#     """
#     complaints_data = []  # list of dicts for later use
#     rows_to_insert  = []

#     for w in wards:
#         wid      = w["ward_id"]
#         citizens = citizen_map.get(wid, [])
#         officers = officer_map.get(wid, [])
#         if not citizens or not officers:
#             continue

#         # 12 historical weeks + current week
#         for weeks_ago in range(0, 13):
#             ws, we    = week_bounds(weeks_ago)
#             ws_dt     = utc(ws)
#             we_dt     = utc(we) + timedelta(days=1)
#             n_complaints = 2 if weeks_ago == 0 else 5

#             for _ in range(n_complaints):
#                 citizen_id  = random.choice(citizens)
#                 officer_id  = random.choice(officers)
#                 category    = random.choices(CATEGORIES, weights=[15,18,12,12,10,5,8,8,7,5])[0]
#                 urgency     = random.choices(URGENCY_LEVELS, weights=[10,25,45,20])[0]
#                 title, desc = COMPLAINT_TEMPLATES[category]
#                 created_at  = rand_dt(ws_dt, we_dt - timedelta(hours=1))

#                 # Decide final status based on age
#                 if weeks_ago == 0:
#                     status = random.choices(["submitted", "assigned"], weights=[60, 40])[0]
#                 elif weeks_ago == 1:
#                     status = random.choices(["assigned", "acknowledged", "in_progress", "resolved"],
#                                             weights=[15, 20, 30, 35])[0]
#                 else:
#                     status = random.choices(["in_progress", "resolved", "closed"],
#                                             weights=[10, 70, 20])[0]

#                 resolved_at = None
#                 if status in STATUS_TERMINAL:
#                     resolved_at = created_at + timedelta(hours=random.uniform(4, SLA_HOURS[category] * 1.5))

#                 sla_hours    = SLA_HOURS[category]
#                 sla_deadline = created_at + timedelta(hours=sla_hours)
#                 sla_breached = resolved_at > sla_deadline if resolved_at else (
#                     datetime.now(timezone.utc) > sla_deadline
#                 )
#                 rating = random.randint(2, 5) if status in STATUS_TERMINAL else None

#                 rows_to_insert.append((
#                     citizen_id, wid, officer_id if status != "submitted" else None,
#                     category, title, desc, status, urgency,
#                     round(w["lat_center"] + random.uniform(-0.01, 0.01), 6),
#                     round(w["lng_center"] + random.uniform(-0.01, 0.01), 6),
#                     f"{w['ward_name']}, Delhi",
#                     sla_hours, sla_deadline, sla_breached,
#                     resolved_at, rating, created_at,
#                 ))
#                 complaints_data.append({
#                     "citizen_id": citizen_id,
#                     "officer_id": officer_id,
#                     "ward_id":    wid,
#                     "category":   category,
#                     "urgency":    urgency,
#                     "status":     status,
#                     "created_at": created_at,
#                     "resolved_at": resolved_at,
#                     "sla_breached": sla_breached,
#                     "weeks_ago":  weeks_ago,
#                 })

#     async with pool.acquire() as conn:
#         await conn.executemany(
#             """INSERT INTO complaints
#                (citizen_id, ward_id, officer_id, category, title, description,
#                 status, urgency, latitude, longitude, address,
#                 sla_hours, sla_deadline, sla_breached, resolved_at, citizen_rating,
#                 created_at, updated_at, submitted_at)
#                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$17)
#                ON CONFLICT DO NOTHING""",
#             rows_to_insert
#         )

#     print(f"✅ {len(rows_to_insert)} complaints seeded")

#     rows = await pool.fetch(
#         """SELECT complaint_id, citizen_id, officer_id, ward_id, category, urgency,
#                   status, created_at, resolved_at, sla_breached
#            FROM complaints ORDER BY created_at"""
#     )
#     return [dict(r) for r in rows]

# # ─── Seed complaint status history ───────────────────────────────────────────

# async def seed_status_history(pool, complaints):
#     """Full pipeline history for each complaint based on its final status."""
#     STATUS_ORDER = ["submitted", "assigned", "acknowledged", "in_progress", "resolved"]
#     rows = []

#     for c in complaints:
#         final  = c["status"]
#         stages = STATUS_ORDER[:STATUS_ORDER.index(final) + 1] if final in STATUS_ORDER else ["submitted", "closed"]
#         t      = c["created_at"]
#         prev   = None
#         for stage in stages:
#             gap = timedelta(hours=random.uniform(0.5, 8))
#             t   = t + gap
#             if c.get("resolved_at") and stage == "resolved":
#                 t = c["resolved_at"]
#             actor   = c["officer_id"] or c["citizen_id"]
#             role    = "officer" if stage not in ("submitted",) else "citizen"
#             notes   = {
#                 "submitted":    "Complaint submitted by citizen",
#                 "assigned":     "Complaint assigned to ward officer",
#                 "acknowledged": "Officer acknowledged the complaint",
#                 "in_progress":  "Repair/resolution work started",
#                 "resolved":     "Issue resolved and verified",
#             }.get(stage, "Status updated")
#             rows.append((c["complaint_id"], actor, role, prev, stage, notes, t))
#             prev = stage

#     async with pool.acquire() as conn:
#         await conn.executemany(
#             """INSERT INTO complaint_status_history
#                (complaint_id, changed_by, changed_by_role, old_status, new_status, notes, created_at)
#                VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING""",
#             rows
#         )
#     print(f"✅ {len(rows)} status history rows seeded")

# # ─── Seed complaint messages (officer ↔ citizen) ──────────────────────────────

# OFFICER_MSGS = [
#     "We have received your complaint and are investigating.",
#     "A team has been dispatched to inspect the site.",
#     "Work has been scheduled for this week.",
#     "The issue has been escalated to the senior engineer.",
#     "Please confirm if the issue has been resolved at your end.",
# ]
# CITIZEN_MSGS = [
#     "Thank you for the update. Please resolve it quickly.",
#     "The issue is still ongoing, kindly expedite.",
#     "I can confirm the work has been completed. Thank you.",
#     "It has been several days, when will this be fixed?",
#     "The problem has worsened since my last report.",
# ]

# async def seed_messages(pool, complaints):
#     """Seed 2–4 messages per complaint that has an assigned officer."""
#     rows = []
#     active = [c for c in complaints if c.get("officer_id") and c["status"] not in ("submitted",)]
#     for c in active[:3000]:  # cap for performance
#         n_msgs = random.randint(2, 4)
#         t      = c["created_at"] + timedelta(hours=2)
#         for i in range(n_msgs):
#             is_officer = (i % 2 == 0)
#             sender_id  = c["officer_id"] if is_officer else c["citizen_id"]
#             role       = "officer" if is_officer else "citizen"
#             text       = random.choice(OFFICER_MSGS if is_officer else CITIZEN_MSGS)
#             rows.append((c["complaint_id"], sender_id, role, text, t))
#             t += timedelta(hours=random.uniform(1, 24))

#     async with pool.acquire() as conn:
#         await conn.executemany(
#             """INSERT INTO complaint_messages
#                (complaint_id, sender_id, sender_role, message_text, created_at)
#                VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING""",
#             rows
#         )
#     print(f"✅ {len(rows)} complaint messages seeded")

# # ─── Seed notifications ───────────────────────────────────────────────────────

# async def seed_notifications(pool, complaints):
#     """
#     For each complaint that changed status, create:
#       - 1 notification for the citizen (status update)
#       - 1 notification for the assigned officer (new assignment)
#     """
#     rows = []
#     for c in complaints[:4000]:  # cap
#         cid = c["complaint_id"]
#         status = c["status"]

#         # Citizen notification
#         rows.append((
#             c["citizen_id"], "citizen", cid,
#             f"Complaint {status.replace('_',' ').title()}",
#             f"Your complaint has been updated to: {status.replace('_',' ')}",
#             "status_update",
#             random.random() > 0.4,  # 60% read
#             c["created_at"] + timedelta(hours=1),
#         ))

#         # Officer notification (if assigned)
#         if c.get("officer_id") and status != "submitted":
#             rows.append((
#                 c["officer_id"], "officer", cid,
#                 "New Complaint Assigned",
#                 f"A {c['category'].replace('_',' ')} complaint has been assigned to you.",
#                 "assignment",
#                 random.random() > 0.3,
#                 c["created_at"] + timedelta(minutes=30),
#             ))

#     async with pool.acquire() as conn:
#         await conn.executemany(
#             """INSERT INTO notifications
#                (user_id, user_role, complaint_id, title, body, type, is_read, created_at)
#                VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING""",
#             rows
#         )
#     print(f"✅ {len(rows)} notifications seeded")

# # ─── Seed ward health scores (12 weeks history) ───────────────────────────────

# async def seed_health_scores(pool, wards):
#     rows = []
#     for w in wards:
#         base_score = float(w["health_score"])
#         for weeks_ago in range(12, -1, -1):
#             ws, _ = week_bounds(weeks_ago)
#             score = round(max(20, min(98, base_score + random.uniform(-8, 8))), 2)
#             res_rate   = round(random.uniform(50, 95), 2)
#             avg_hrs    = round(random.uniform(12, 96), 2)
#             breach_rate = round(random.uniform(0, 30), 2)
#             rows.append((w["ward_id"], score, res_rate, avg_hrs, breach_rate, utc(ws)))

#     async with pool.acquire() as conn:
#         await conn.executemany(
#             """INSERT INTO ward_health_scores
#                (ward_id, composite_score, resolution_rate, avg_response_hrs, sla_breach_rate, calculated_at)
#                VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING""",
#             rows
#         )
#     print(f"✅ {len(rows)} ward health score rows seeded")

# # ─── Seed weekly digests (ward + zone + city, 13 weeks) ──────────────────────

# async def seed_weekly_digests(pool, wards, complaints):
#     """
#     Seeds full weekly_digests for ALL 272 wards × 13 weeks,
#     ALL 10 zones × 13 weeks, and city × 13 weeks.
#     Uses real complaint data already inserted.
#     """
#     print("⏳ Seeding weekly digests (ward × zone × city × 13 weeks)…")

#     # Index complaints by ward_id and week
#     from collections import defaultdict
#     ward_week_complaints: dict[tuple, list] = defaultdict(list)
#     for c in complaints:
#         for weeks_ago in range(13):
#             ws, we = week_bounds(weeks_ago)
#             ws_dt  = utc(ws)
#             we_dt  = utc(we) + timedelta(days=1)
#             if ws_dt <= c["created_at"] < we_dt:
#                 ward_week_complaints[(c["ward_id"], ws)].append(c)
#                 break

#     # Build zone → ward_ids map
#     zone_wards: dict[str, list] = defaultdict(list)
#     for w in wards:
#         zone_wards[w["zone"]].append(w["ward_id"])
#     ward_zone = {w["ward_id"]: w["zone"] for w in wards}

#     digest_rows = []

#     for weeks_ago in range(13):
#         ws, we = week_bounds(weeks_ago)
#         ws_dt  = utc(ws)
#         we_dt  = utc(we) + timedelta(days=1)

#         # ── Ward digests ──────────────────────────────────────────────────────
#         for w in wards:
#             wid   = w["ward_id"]
#             comps = ward_week_complaints[(wid, ws)]
#             total    = len(comps)
#             resolved = sum(1 for c in comps if c["status"] in STATUS_TERMINAL)
#             pending  = total - resolved
#             res_rate = round((resolved / max(total, 1)) * 100, 1)
#             avg_hrs  = round(
#                 sum((c["resolved_at"] - c["created_at"]).total_seconds() / 3600
#                     for c in comps if c.get("resolved_at")) /
#                 max(sum(1 for c in comps if c.get("resolved_at")), 1), 1
#             )
#             breaches    = sum(1 for c in comps if c["sla_breached"])
#             score_start = round(float(w["health_score"]) + random.uniform(-5, 5), 2)
#             score_end   = round(score_start + random.uniform(-3, 5), 2)
#             top_cat     = max(CATEGORIES, key=lambda cat: sum(1 for c in comps if c["category"] == cat)) if comps else "other"
#             cat_json    = category_breakdown_json(comps) if comps else "[]"
#             urg_json    = urgency_breakdown_json(comps)  if comps else "[]"
#             summary     = (f"{w['ward_name']}: {total} complaints, "
#                            f"{resolved} resolved ({res_rate:.0f}%) in week of {ws.strftime('%b %d')}.")
#             achievements, concerns = build_achievements_concerns(
#                 res_rate, avg_hrs, score_start, score_end, breaches, total)
#             published_at = utc(we) + timedelta(days=1, hours=23)

#             digest_rows.append((
#                 "ward", wid, None,  # digest_type, ward_id, zone_name
#                 ws, we,
#                 total, resolved, pending, res_rate, avg_hrs, top_cat,
#                 cat_json, urg_json,
#                 score_start, score_end, round(score_end - score_start, 2),
#                 summary, summary,  # summary_en, summary_hi (same for mock)
#                 achievements, concerns,
#                 True, published_at,
#             ))

#         # ── Zone digests ──────────────────────────────────────────────────────
#         for zone, wids in zone_wards.items():
#             zone_comps = [c for wid in wids for c in ward_week_complaints[(wid, ws)]]
#             total    = len(zone_comps)
#             resolved = sum(1 for c in zone_comps if c["status"] in STATUS_TERMINAL)
#             pending  = total - resolved
#             res_rate = round((resolved / max(total, 1)) * 100, 1)
#             avg_hrs  = round(
#                 sum((c["resolved_at"] - c["created_at"]).total_seconds() / 3600
#                     for c in zone_comps if c.get("resolved_at")) /
#                 max(sum(1 for c in zone_comps if c.get("resolved_at")), 1), 1
#             )
#             breaches    = sum(1 for c in zone_comps if c["sla_breached"])
#             score_end   = round(random.uniform(45, 85), 2)
#             score_start = round(score_end - random.uniform(-3, 5), 2)
#             top_cat  = max(CATEGORIES, key=lambda cat: sum(1 for c in zone_comps if c["category"] == cat)) if zone_comps else "other"
#             cat_json = category_breakdown_json(zone_comps) if zone_comps else "[]"
#             urg_json = urgency_breakdown_json(zone_comps)  if zone_comps else "[]"
#             summary  = (f"{zone} Zone: {total} complaints city-wide, "
#                         f"{resolved} resolved ({res_rate:.0f}%) for week of {ws.strftime('%b %d')}.")
#             achievements, concerns = build_achievements_concerns(
#                 res_rate, avg_hrs, score_start, score_end, breaches, total)

#             digest_rows.append((
#                 "zone", None, zone,  # ward_id=None for zone rows
#                 ws, we,
#                 total, resolved, pending, res_rate, avg_hrs, top_cat,
#                 cat_json, urg_json,
#                 score_start, score_end, round(score_end - score_start, 2),
#                 summary, summary,
#                 achievements, concerns,
#                 True, utc(we) + timedelta(days=1, hours=23),
#             ))

#         # ── City digest ───────────────────────────────────────────────────────
#         all_comps = [c for key_comps in ward_week_complaints.values()
#                      for c in key_comps if key_comps and utc(ws) <= c["created_at"] < we_dt]
#         # simpler: pull all for this week
#         all_comps = [c for c in complaints if utc(ws) <= c["created_at"] < we_dt]
#         total    = len(all_comps)
#         resolved = sum(1 for c in all_comps if c["status"] in STATUS_TERMINAL)
#         pending  = total - resolved
#         res_rate = round((resolved / max(total, 1)) * 100, 1)
#         avg_hrs  = round(
#             sum((c["resolved_at"] - c["created_at"]).total_seconds() / 3600
#                 for c in all_comps if c.get("resolved_at")) /
#             max(sum(1 for c in all_comps if c.get("resolved_at")), 1), 1
#         )
#         breaches    = sum(1 for c in all_comps if c["sla_breached"])
#         score_end   = round(random.uniform(55, 75), 2)
#         score_start = round(score_end - random.uniform(-3, 4), 2)
#         top_cat  = max(CATEGORIES, key=lambda cat: sum(1 for c in all_comps if c["category"] == cat)) if all_comps else "other"
#         cat_json = category_breakdown_json(all_comps) if all_comps else "[]"
#         urg_json = urgency_breakdown_json(all_comps)  if all_comps else "[]"
#         summary  = (f"MCD Delhi: {total} complaints across all wards, "
#                     f"{resolved} resolved ({res_rate:.0f}%) for week of {ws.strftime('%b %d')}.")
#         achievements, concerns = build_achievements_concerns(
#             res_rate, avg_hrs, score_start, score_end, breaches, total)

#         digest_rows.append((
#             "city", None, None,
#             ws, we,
#             total, resolved, pending, res_rate, avg_hrs, top_cat,
#             cat_json, urg_json,
#             score_start, score_end, round(score_end - score_start, 2),
#             summary, summary,
#             achievements, concerns,
#             True, utc(we) + timedelta(days=1, hours=23),
#         ))

#     # Batch insert — ward rows use UNIQUE(ward_id, week_start), zone/city use ON CONFLICT DO NOTHING
#     ward_rows = [r for r in digest_rows if r[0] == "ward"]
#     other_rows = [r for r in digest_rows if r[0] != "ward"]

#     async with pool.acquire() as conn:
#         # Ward digests — use ON CONFLICT UPDATE so re-runs are safe
#         await conn.executemany(
#             """INSERT INTO weekly_digests
#                (digest_type, ward_id, zone_name, week_start, week_end,
#                 total_complaints, resolved_complaints, pending_complaints,
#                 resolution_rate, avg_resolution_hours, top_category,
#                 category_breakdown, urgency_breakdown,
#                 health_score_start, health_score_end, score_change,
#                 summary_en, summary_hi, key_achievements, areas_of_concern,
#                 is_published, published_at)
#                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
#                ON CONFLICT (ward_id, week_start) DO UPDATE SET
#                  total_complaints=EXCLUDED.total_complaints,
#                  resolved_complaints=EXCLUDED.resolved_complaints,
#                  pending_complaints=EXCLUDED.pending_complaints,
#                  resolution_rate=EXCLUDED.resolution_rate,
#                  avg_resolution_hours=EXCLUDED.avg_resolution_hours,
#                  category_breakdown=EXCLUDED.category_breakdown,
#                  urgency_breakdown=EXCLUDED.urgency_breakdown,
#                  summary_en=EXCLUDED.summary_en,
#                  is_published=TRUE""",
#             ward_rows
#         )

#         # Zone + city digests
#         await conn.executemany(
#             """INSERT INTO weekly_digests
#                (digest_type, ward_id, zone_name, week_start, week_end,
#                 total_complaints, resolved_complaints, pending_complaints,
#                 resolution_rate, avg_resolution_hours, top_category,
#                 category_breakdown, urgency_breakdown,
#                 health_score_start, health_score_end, score_change,
#                 summary_en, summary_hi, key_achievements, areas_of_concern,
#                 is_published, published_at)
#                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
#                ON CONFLICT DO NOTHING""",
#             other_rows
#         )

#     ward_count  = len(ward_rows)
#     zone_count  = sum(1 for r in other_rows if r[0] == "zone")
#     city_count  = sum(1 for r in other_rows if r[0] == "city")
#     print(f"✅ Weekly digests: {ward_count} ward rows, {zone_count} zone rows, {city_count} city rows")

# # ─── MAIN ─────────────────────────────────────────────────────────────────────

# async def main():
#     print(f"\n{'='*60}")
#     print("NagarMind — Full Database Reset & Seed (v7)")
#     print(f"{'='*60}\n")

#     pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)

#     print("Step 1/9 — Drop all tables…")
#     await drop_all_tables(pool)

#     print("Step 2/9 — Create schema…")
#     await create_schema(pool)

#     print("Step 3/9 — Seed wards…")
#     wards = await seed_wards(pool)

#     print("Step 4/9 — Seed admins…")
#     await seed_admins(pool)

#     print("Step 5/9 — Seed officers…")
#     officer_map = await seed_officers(pool, wards)

#     print("Step 6/9 — Seed citizens…")
#     citizen_map = await seed_citizens(pool, wards)

#     print("Step 7/9 — Seed complaints + status history + messages…")
#     complaints = await seed_complaints(pool, wards, citizen_map, officer_map)
#     await seed_status_history(pool, complaints)
#     await seed_messages(pool, complaints)

#     print("Step 8/9 — Seed notifications…")
#     await seed_notifications(pool, complaints)

#     print("Step 8b/9 — Seed ward health scores…")
#     await seed_health_scores(pool, wards)

#     print("Step 9/9 — Seed weekly digests (ward + zone + city × 13 weeks)…")
#     await seed_weekly_digests(pool, wards, complaints)

#     await pool.close()

#     print(f"\n{'='*60}")
#     print("✅ DATABASE FULLY SEEDED")
#     print(f"{'='*60}")
#     print("""
# CREDENTIALS:
#   Admin:   MCD-ADMIN-001 / Admin@123!
#            MCD-ADMIN-002 / Admin@456!   ← (same pw Admin@123!)
#   Officer: officer{ward_id}_1@mcd.delhi.gov.in / Officer@123!
#   Citizen: citizen{ward_id}_1@test.com  / TestPass@123

# DATA:
#   272 wards  ×  10 zones
#   2 admins  |  544 officers  |  2720 citizens
#   ~18,000 complaints across 13 weeks
#   complaint_messages: officer↔citizen per complaint
#   notifications: citizen + officer inboxes populated
#   weekly_digests: ward × zone × city × 13 weeks
#     (category_breakdown + urgency_breakdown + summaries included)
# """)

# if __name__ == "__main__":
#     asyncio.run(main())

"""
NagarMind — Complete Database Setup & Seed Script (v7)
=======================================================

CHANGES FROM v6:
  - complaint_status_history: column renamed  notes  →  note  (matches complaints.py)
  - notifications: column renamed  body  (was missing; service used 'message')
  - ward_health_scores: added all columns ward_health_service.py writes:
      grade, trend, score_delta_7d, overdue_count,
      total_complaints, resolved_complaints, overdue_complaints, avg_rating
  - seed_status_history: uses  note  column
  - seed_notifications:  uses  body  column
  - seed_health_scores:  writes all new columns

WHAT THIS SCRIPT DOES:
  1. Drops and recreates ALL tables with correct schema
  2. Seeds 272 Delhi wards across 10 zones
  3. Seeds 2 admins + 544 officers (2 per ward) with phones
  4. Seeds 2720 citizens (10 per ward) with full profiles
  5. Seeds ~18,000 complaints (multi-status, multi-week spread)
  6. Seeds complaint_status_history (full pipeline)
  7. Seeds notifications for officers AND citizens
  8. Seeds ward_health_scores (weekly, 12 weeks back)
  9. Seeds weekly_digests (ward × zone × city × 13 weeks)
  10. Seeds complaint_messages (officer↔citizen communication)

RUN:
  cd backend
  python scripts/setup_database_v7.py
"""

import asyncio
import asyncpg
import os
import json
import random
import uuid
import bcrypt
from datetime import datetime, timedelta, date, timezone
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# ─── Constants ────────────────────────────────────────────────────────────────

CATEGORIES = ["pothole", "garbage", "sewage", "water_supply", "streetlight",
              "tree", "stray_animals", "encroachment", "noise", "other"]

URGENCY_LEVELS  = ["critical", "high", "medium", "low"]
URGENCY_WEIGHTS = [0.10, 0.25, 0.45, 0.20]

SLA_HOURS = {
    "pothole": 48, "garbage": 24, "sewage": 12, "water_supply": 24,
    "streetlight": 72, "tree": 96, "stray_animals": 48,
    "encroachment": 120, "noise": 24, "other": 72,
}

STATUS_PIPELINE = ["submitted", "assigned", "acknowledged", "in_progress", "resolved"]
STATUS_TERMINAL = {"resolved", "closed"}

ZONES = [
    "Central", "City SP", "Civil Lines", "Keshavpuram",
    "Najafgarh", "Narela", "Rohini", "Sadar Paharganj",
    "Shahdara North", "Shahdara South",
]

# ─── Delhi Ward Data ──────────────────────────────────────────────────────────

def generate_wards():
    wards = []
    ward_id = 1
    counts = {
        "Central": 26, "City SP": 28, "Civil Lines": 29, "Keshavpuram": 28,
        "Najafgarh": 28, "Narela": 28, "Rohini": 30, "Sadar Paharganj": 26,
        "Shahdara North": 35, "Shahdara South": 34,
    }
    ZONE_COORDS = {
        "Central":         (28.6280, 77.2290),
        "City SP":         (28.6550, 77.2300),
        "Civil Lines":     (28.6870, 77.2230),
        "Keshavpuram":     (28.6930, 77.1560),
        "Najafgarh":       (28.6090, 76.9800),
        "Narela":          (28.8520, 77.0930),
        "Rohini":          (28.7380, 77.1090),
        "Sadar Paharganj": (28.6440, 77.1990),
        "Shahdara North":  (28.7120, 77.2960),
        "Shahdara South":  (28.6650, 77.3010),
    }
    grade_map = {(80, 101): "A", (60, 80): "B", (40, 60): "C", (20, 40): "D", (0, 20): "F"}
    for zone, count in counts.items():
        base_lat, base_lng = ZONE_COORDS[zone]
        for i in range(1, count + 1):
            health = round(random.uniform(35, 92), 2)
            grade  = next(g for (lo, hi), g in grade_map.items() if lo <= health < hi)
            lat    = round(base_lat + random.uniform(-0.08, 0.08), 6)
            lng    = round(base_lng + random.uniform(-0.08, 0.08), 6)
            wards.append({
                "ward_id":      ward_id,
                "ward_name":    f"Ward {ward_id} - {zone}",
                "zone":         zone,
                "health_score": health,
                "health_grade": grade,
                "lat_center":   lat,
                "lng_center":   lng,
            })
            ward_id += 1
    return wards

# ─── Schema DDL ───────────────────────────────────────────────────────────────

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- WARDS
CREATE TABLE wards (
    ward_id          INTEGER PRIMARY KEY,
    ward_name        TEXT    NOT NULL,
    zone             TEXT    NOT NULL,
    health_score     DECIMAL(5,2) DEFAULT 50,
    health_grade     TEXT    DEFAULT 'C',
    health_updated_at TIMESTAMPTZ,
    lat_center       DECIMAL(10,6),
    lng_center       DECIMAL(10,6),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ADMINS
CREATE TABLE admins (
    admin_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id   TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    phone_number  TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'admin',
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- OFFICERS
CREATE TABLE officers (
    officer_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id   TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    phone_number  TEXT,
    ward_id       INTEGER REFERENCES wards(ward_id),
    designation   TEXT DEFAULT 'Field Officer',
    is_active     BOOLEAN DEFAULT TRUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- CITIZENS
CREATE TABLE citizens (
    citizen_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    phone_number  TEXT UNIQUE NOT NULL,
    ward_id       INTEGER REFERENCES wards(ward_id),
    address       TEXT,
    password_hash TEXT NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- COMPLAINTS
CREATE TABLE complaints (
    complaint_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    citizen_id       UUID REFERENCES citizens(citizen_id),
    ward_id          INTEGER REFERENCES wards(ward_id),
    officer_id       UUID REFERENCES officers(officer_id),
    category         TEXT,
    subcategory      TEXT,
    title            TEXT NOT NULL,
    description      TEXT NOT NULL,
    status           TEXT DEFAULT 'submitted',
    urgency          TEXT DEFAULT 'medium',
    latitude         DECIMAL(10,6),
    longitude        DECIMAL(10,6),
    address          TEXT,
    photo_urls       TEXT[] DEFAULT '{}',
    voice_transcript TEXT,
    ai_summary       TEXT,
    resolution_note  TEXT,
    sla_hours        INTEGER DEFAULT 72,
    sla_deadline     TIMESTAMPTZ,
    sla_breached     BOOLEAN DEFAULT FALSE,
    resolved_at      TIMESTAMPTZ,
    citizen_rating   INTEGER,
    citizen_feedback TEXT,
    submitted_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- COMPLAINT STATUS HISTORY
-- NOTE: column is 'note' (no s) — matches complaints.py INSERT statements
CREATE TABLE complaint_status_history (
    history_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id    UUID REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    changed_by      UUID,
    changed_by_role TEXT,
    old_status      TEXT,
    new_status      TEXT NOT NULL,
    note            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- COMPLAINT MESSAGES (Officer ↔ Citizen)
CREATE TABLE complaint_messages (
    message_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    sender_id    UUID NOT NULL,
    sender_role  TEXT NOT NULL,
    sender_name  TEXT,
    message_text TEXT NOT NULL,
    is_read      BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
-- NOTE: column is 'body' — matches notification_service.py INSERT statements
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    user_role       TEXT NOT NULL,
    complaint_id    UUID REFERENCES complaints(complaint_id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    type            TEXT DEFAULT 'status_update',
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- WARD HEALTH SCORES (historical snapshots)
-- NOTE: all columns ward_health_service.py writes are present here
CREATE TABLE ward_health_scores (
    score_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ward_id             INTEGER REFERENCES wards(ward_id),
    calculated_at       TIMESTAMPTZ DEFAULT NOW(),
    -- rates & counts
    resolution_rate     DECIMAL(5,2),
    overdue_count       INTEGER DEFAULT 0,
    overdue_complaints  INTEGER DEFAULT 0,
    total_complaints    INTEGER DEFAULT 0,
    resolved_complaints INTEGER DEFAULT 0,
    -- composite score & grade
    composite_score     DECIMAL(5,2) NOT NULL,
    grade               TEXT DEFAULT 'C',
    -- trend
    trend               TEXT DEFAULT 'stable',
    score_delta_7d      DECIMAL(5,2) DEFAULT 0,
    -- legacy columns (kept for seed script compatibility)
    avg_response_hrs    DECIMAL(8,2),
    sla_breach_rate     DECIMAL(5,2),
    avg_rating          DECIMAL(3,2) DEFAULT 0
);

-- WEEKLY DIGESTS
CREATE TABLE weekly_digests (
    digest_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    digest_type          TEXT NOT NULL DEFAULT 'ward',
    ward_id              INTEGER REFERENCES wards(ward_id),
    zone_name            TEXT,
    week_start           DATE NOT NULL,
    week_end             DATE NOT NULL,
    total_complaints     INTEGER DEFAULT 0,
    resolved_complaints  INTEGER DEFAULT 0,
    pending_complaints   INTEGER DEFAULT 0,
    resolution_rate      DECIMAL(5,2) DEFAULT 0,
    avg_resolution_hours DECIMAL(8,2) DEFAULT 0,
    top_category         TEXT,
    category_breakdown   JSONB,
    urgency_breakdown    JSONB,
    health_score_start   DECIMAL(5,2) DEFAULT 50,
    health_score_end     DECIMAL(5,2) DEFAULT 50,
    score_change         DECIMAL(5,2) DEFAULT 0,
    summary_en           TEXT,
    summary_hi           TEXT,
    key_achievements     TEXT[] DEFAULT '{}',
    areas_of_concern     TEXT[] DEFAULT '{}',
    is_published         BOOLEAN DEFAULT FALSE,
    published_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (ward_id, week_start)
);

-- PREDICTIVE ALERTS
CREATE TABLE predictive_alerts (
    alert_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ward_id     INTEGER REFERENCES wards(ward_id),
    alert_type  TEXT NOT NULL,
    severity    TEXT DEFAULT 'medium',
    title       TEXT NOT NULL,
    description TEXT,
    evidence    JSONB DEFAULT '{}',
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ
);
"""

# ─── Helpers ──────────────────────────────────────────────────────────────────

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def utc(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)

def rand_dt(start: datetime, end: datetime) -> datetime:
    delta = (end - start).total_seconds()
    return start + timedelta(seconds=random.uniform(0, delta))

TODAY = datetime.now(timezone.utc).date()

def week_bounds(weeks_ago: int) -> tuple[date, date]:
    end   = TODAY - timedelta(days=7 * weeks_ago)
    start = end   - timedelta(days=6)
    return start, end

def category_breakdown_json(complaints_subset):
    from collections import Counter
    counts = Counter(c["category"] for c in complaints_subset)
    return json.dumps([{"category": k, "count": v} for k, v in counts.most_common()])

def urgency_breakdown_json(complaints_subset):
    from collections import Counter
    counts = Counter(c["urgency"] for c in complaints_subset)
    return json.dumps([{"urgency": k, "count": v} for k, v in counts.most_common()])

def build_achievements_concerns(resolution_rate, avg_hours, score_start, score_end, breach_count, total):
    achievements, concerns = [], []
    if resolution_rate >= 80:
        achievements.append(f"Excellent resolution rate of {resolution_rate:.0f}%")
    elif resolution_rate >= 60:
        achievements.append(f"Good resolution rate of {resolution_rate:.0f}%")
    if 0 < avg_hours < 24:
        achievements.append(f"Fast avg resolution: {avg_hours:.0f}h")
    if score_end > score_start + 2:
        achievements.append(f"Health score improved by {score_end - score_start:.1f} pts")
    if not achievements:
        achievements.append("Civic operations maintained this week")
    if breach_count > 0:
        concerns.append(f"{breach_count} SLA {'breach' if breach_count == 1 else 'breaches'} this week")
    if resolution_rate < 60:
        concerns.append(f"Low resolution rate: {resolution_rate:.0f}%")
    if total > 50:
        concerns.append(f"High complaint volume: {total} received")
    if avg_hours > 72:
        concerns.append(f"Slow resolution: {avg_hours:.0f}h avg")
    if not concerns:
        concerns.append("No major concerns this week")
    return achievements, concerns

# ─── Drop all tables ──────────────────────────────────────────────────────────

async def drop_all_tables(pool):
    async with pool.acquire() as conn:
        await conn.execute("""
            DROP TABLE IF EXISTS
                predictive_alerts, weekly_digests, ward_health_scores,
                complaint_messages, notifications, complaint_status_history,
                complaints, citizens, officers, admins, wards
            CASCADE;
            DROP TABLE IF EXISTS alembic_version CASCADE;
        """)
    print("✅ All tables dropped")

# ─── Create schema ────────────────────────────────────────────────────────────

async def create_schema(pool):
    async with pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)
    print("✅ Schema created")

# ─── Seed wards ──────────────────────────────────────────────────────────────

async def seed_wards(pool):
    wards = generate_wards()
    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO wards (ward_id, ward_name, zone, health_score, health_grade, lat_center, lng_center)
               VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING""",
            [(w["ward_id"], w["ward_name"], w["zone"], w["health_score"],
              w["health_grade"], w["lat_center"], w["lng_center"]) for w in wards]
        )
    print(f"✅ {len(wards)} wards seeded")
    return wards

# ─── Seed admins ──────────────────────────────────────────────────────────────

async def seed_admins(pool):
    pw = hash_password("Admin@123!")
    admins = [
        ("MCD-ADMIN-001", "Rajesh Kumar Sharma", "admin1@mcd.delhi.gov.in", "+919810001001", pw),
        ("MCD-ADMIN-002", "Priya Malhotra",       "admin2@mcd.delhi.gov.in", "+919810001002", pw),
    ]
    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO admins (employee_id, name, email, phone_number, password_hash)
               VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING""",
            admins
        )
    print(f"✅ {len(admins)} admins seeded")

# ─── Seed officers ────────────────────────────────────────────────────────────

async def seed_officers(pool, wards):
    pw = hash_password("Officer@123!")
    DESIGNATIONS = ["Junior Engineer", "Assistant Engineer", "Field Officer",
                    "Sanitation Officer", "Health Inspector"]
    officers = []
    for w in wards:
        wid = w["ward_id"]
        for i in range(1, 3):
            emp_id = f"OFF-{wid:03d}-{i}"
            name   = f"Officer {wid}-{i}"
            email  = f"officer{wid}_{i}@mcd.delhi.gov.in"
            phone  = f"+9198{wid:04d}{i:03d}"[:13]
            desig  = random.choice(DESIGNATIONS)
            officers.append((emp_id, name, email, phone, wid, desig, pw))

    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO officers (employee_id, name, email, phone_number, ward_id, designation, password_hash)
               VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING""",
            officers
        )
    print(f"✅ {len(officers)} officers seeded")

    rows = await pool.fetch("SELECT officer_id, ward_id FROM officers ORDER BY ward_id, employee_id")
    officer_map: dict[int, list] = {}
    for r in rows:
        officer_map.setdefault(r["ward_id"], []).append(r["officer_id"])
    return officer_map

# ─── Seed citizens ────────────────────────────────────────────────────────────

async def seed_citizens(pool, wards):
    pw = hash_password("TestPass@123")
    FIRST = ["Amit","Priya","Rahul","Sunita","Vikram","Anjali","Rohit","Neha",
             "Sanjay","Kavita","Arjun","Pooja","Deepak","Meera","Arun"]
    LAST  = ["Sharma","Gupta","Singh","Verma","Kumar","Jain","Agarwal",
             "Mishra","Yadav","Tiwari","Srivastava","Pandey"]
    citizens = []
    for w in wards:
        wid = w["ward_id"]
        for i in range(1, 11):
            name  = f"{random.choice(FIRST)} {random.choice(LAST)}"
            email = f"citizen{wid}_{i}@test.com"
            phone = f"+9199{wid:04d}{i:03d}"[:13]
            addr  = f"House {i}, {w['ward_name']}, {w['zone']} Zone, Delhi"
            citizens.append((name, email, phone, wid, addr, pw))

    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO citizens (name, email, phone_number, ward_id, address, password_hash)
               VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING""",
            citizens
        )
    print(f"✅ {len(citizens)} citizens seeded")

    rows = await pool.fetch("SELECT citizen_id, ward_id FROM citizens ORDER BY ward_id, email")
    citizen_map: dict[int, list] = {}
    for r in rows:
        citizen_map.setdefault(r["ward_id"], []).append(r["citizen_id"])
    return citizen_map

# ─── Seed complaints ──────────────────────────────────────────────────────────

COMPLAINT_TEMPLATES = {
    "pothole":       ("Large Pothole on Main Road",    "Deep pothole causing accidents near the junction."),
    "garbage":       ("Uncollected Garbage Pile",      "Garbage not collected for several days, causing stench."),
    "sewage":        ("Sewage Overflow on Street",     "Overflowing sewer blocking pedestrian path."),
    "water_supply":  ("No Water Supply for Days",      "Water supply disrupted for residents of this area."),
    "streetlight":   ("Street Lights Not Working",     "Multiple streetlights broken, area unsafe at night."),
    "tree":          ("Fallen Tree Blocking Road",     "Large tree fell due to storm, blocking main road."),
    "stray_animals": ("Aggressive Stray Dogs",         "Pack of stray dogs attacking pedestrians near park."),
    "encroachment":  ("Illegal Encroachment",          "Shop owner has encroached footpath, blocking access."),
    "noise":         ("Noise Pollution from Site",     "Construction site causing extreme noise past midnight."),
    "other":         ("Civic Issue Reported",          "Miscellaneous civic issue affecting residents."),
}

async def seed_complaints(pool, wards, citizen_map, officer_map):
    complaints_data = []
    rows_to_insert  = []

    for w in wards:
        wid      = w["ward_id"]
        citizens = citizen_map.get(wid, [])
        officers = officer_map.get(wid, [])
        if not citizens or not officers:
            continue

        for weeks_ago in range(0, 13):
            ws, we       = week_bounds(weeks_ago)
            ws_dt        = utc(ws)
            we_dt        = utc(we) + timedelta(days=1)
            n_complaints = 2 if weeks_ago == 0 else 5

            for _ in range(n_complaints):
                citizen_id  = random.choice(citizens)
                officer_id  = random.choice(officers)
                category    = random.choices(CATEGORIES, weights=[15,18,12,12,10,5,8,8,7,5])[0]
                urgency     = random.choices(URGENCY_LEVELS, weights=[10,25,45,20])[0]
                title, desc = COMPLAINT_TEMPLATES[category]
                created_at  = rand_dt(ws_dt, we_dt - timedelta(hours=1))

                if weeks_ago == 0:
                    status = random.choices(["submitted","assigned"], weights=[60,40])[0]
                elif weeks_ago == 1:
                    status = random.choices(["assigned","acknowledged","in_progress","resolved"],
                                            weights=[15,20,30,35])[0]
                else:
                    status = random.choices(["in_progress","resolved","closed"], weights=[10,70,20])[0]

                resolved_at = None
                if status in STATUS_TERMINAL:
                    resolved_at = created_at + timedelta(hours=random.uniform(4, SLA_HOURS[category] * 1.5))

                sla_hours    = SLA_HOURS[category]
                sla_deadline = created_at + timedelta(hours=sla_hours)
                sla_breached = (resolved_at > sla_deadline if resolved_at
                                else datetime.now(timezone.utc) > sla_deadline)
                rating = random.randint(2, 5) if status in STATUS_TERMINAL else None

                rows_to_insert.append((
                    citizen_id, wid, officer_id if status != "submitted" else None,
                    category, title, desc, status, urgency,
                    round(w["lat_center"] + random.uniform(-0.01, 0.01), 6),
                    round(w["lng_center"] + random.uniform(-0.01, 0.01), 6),
                    f"{w['ward_name']}, Delhi",
                    sla_hours, sla_deadline, sla_breached,
                    resolved_at, rating, created_at,
                ))
                complaints_data.append({
                    "citizen_id":  citizen_id,
                    "officer_id":  officer_id,
                    "ward_id":     wid,
                    "category":    category,
                    "urgency":     urgency,
                    "status":      status,
                    "created_at":  created_at,
                    "resolved_at": resolved_at,
                    "sla_breached": sla_breached,
                    "weeks_ago":   weeks_ago,
                })

    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO complaints
               (citizen_id, ward_id, officer_id, category, title, description,
                status, urgency, latitude, longitude, address,
                sla_hours, sla_deadline, sla_breached, resolved_at, citizen_rating,
                created_at, updated_at, submitted_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$17)
               ON CONFLICT DO NOTHING""",
            rows_to_insert
        )

    print(f"✅ {len(rows_to_insert)} complaints seeded")

    rows = await pool.fetch(
        """SELECT complaint_id, citizen_id, officer_id, ward_id, category, urgency,
                  status, created_at, resolved_at, sla_breached
           FROM complaints ORDER BY created_at"""
    )
    return [dict(r) for r in rows]

# ─── Seed complaint status history ───────────────────────────────────────────
# NOTE: uses column  note  (no 's') — matches complaints.py

async def seed_status_history(pool, complaints):
    STATUS_ORDER = ["submitted", "assigned", "acknowledged", "in_progress", "resolved"]
    rows = []

    for c in complaints:
        final  = c["status"]
        stages = STATUS_ORDER[:STATUS_ORDER.index(final) + 1] if final in STATUS_ORDER else ["submitted", "closed"]
        t      = c["created_at"]
        prev   = None
        for stage in stages:
            t += timedelta(hours=random.uniform(0.5, 8))
            if c.get("resolved_at") and stage == "resolved":
                t = c["resolved_at"]
            actor = c["officer_id"] or c["citizen_id"]
            role  = "officer" if stage != "submitted" else "citizen"
            note  = {
                "submitted":    "Complaint submitted by citizen",
                "assigned":     "Complaint assigned to ward officer",
                "acknowledged": "Officer acknowledged the complaint",
                "in_progress":  "Repair/resolution work started",
                "resolved":     "Issue resolved and verified",
            }.get(stage, "Status updated")
            rows.append((c["complaint_id"], actor, role, prev, stage, note, t))
            prev = stage

    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO complaint_status_history
               (complaint_id, changed_by, changed_by_role, old_status, new_status, note, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING""",
            rows
        )
    print(f"✅ {len(rows)} status history rows seeded")

# ─── Seed complaint messages ──────────────────────────────────────────────────

OFFICER_MSGS = [
    "We have received your complaint and are investigating.",
    "A team has been dispatched to inspect the site.",
    "Work has been scheduled for this week.",
    "The issue has been escalated to the senior engineer.",
    "Please confirm if the issue has been resolved at your end.",
]
CITIZEN_MSGS = [
    "Thank you for the update. Please resolve it quickly.",
    "The issue is still ongoing, kindly expedite.",
    "I can confirm the work has been completed. Thank you.",
    "It has been several days, when will this be fixed?",
    "The problem has worsened since my last report.",
]

async def seed_messages(pool, complaints):
    rows = []
    active = [c for c in complaints if c.get("officer_id") and c["status"] != "submitted"]
    for c in active[:3000]:
        n_msgs = random.randint(2, 4)
        t = c["created_at"] + timedelta(hours=2)
        for i in range(n_msgs):
            is_officer = (i % 2 == 0)
            sender_id  = c["officer_id"] if is_officer else c["citizen_id"]
            role       = "officer" if is_officer else "citizen"
            text       = random.choice(OFFICER_MSGS if is_officer else CITIZEN_MSGS)
            rows.append((c["complaint_id"], sender_id, role, text, t))
            t += timedelta(hours=random.uniform(1, 24))

    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO complaint_messages
               (complaint_id, sender_id, sender_role, message_text, created_at)
               VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING""",
            rows
        )
    print(f"✅ {len(rows)} complaint messages seeded")

# ─── Seed notifications ───────────────────────────────────────────────────────
# NOTE: uses column  body  — matches notification_service.py

async def seed_notifications(pool, complaints):
    rows = []
    for c in complaints[:4000]:
        cid    = c["complaint_id"]
        status = c["status"]

        # Citizen notification
        rows.append((
            c["citizen_id"], "citizen", cid,
            f"Complaint {status.replace('_',' ').title()}",
            f"Your complaint has been updated to: {status.replace('_',' ')}",
            "status_update",
            random.random() > 0.4,
            c["created_at"] + timedelta(hours=1),
        ))

        # Officer notification
        if c.get("officer_id") and status != "submitted":
            rows.append((
                c["officer_id"], "officer", cid,
                "New Complaint Assigned",
                f"A {c['category'].replace('_',' ')} complaint has been assigned to you.",
                "assignment",
                random.random() > 0.3,
                c["created_at"] + timedelta(minutes=30),
            ))

    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO notifications
               (user_id, user_role, complaint_id, title, body, type, is_read, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING""",
            rows
        )
    print(f"✅ {len(rows)} notifications seeded")

# ─── Seed ward health scores ──────────────────────────────────────────────────
# NOTE: writes all columns ward_health_service.py expects

async def seed_health_scores(pool, wards):
    rows = []
    for w in wards:
        base_score = float(w["health_score"])
        for weeks_ago in range(12, -1, -1):
            ws, _ = week_bounds(weeks_ago)
            score      = round(max(20, min(98, base_score + random.uniform(-8, 8))), 2)
            res_rate   = round(random.uniform(50, 95), 2)
            avg_hrs    = round(random.uniform(12, 96), 2)
            breach_rate = round(random.uniform(0, 30), 2)
            grade      = ("A" if score >= 80 else "B" if score >= 65 else
                          "C" if score >= 50 else "D" if score >= 35 else "F")
            trend      = random.choice(["improving", "stable", "declining"])
            delta      = round(random.uniform(-5, 5), 2)
            rows.append((
                w["ward_id"], score, res_rate, avg_hrs, breach_rate,
                grade, trend, delta,
                random.randint(5, 50),   # total_complaints
                random.randint(2, 40),   # resolved_complaints
                random.randint(0, 10),   # overdue_complaints
                random.randint(0, 10),   # overdue_count
                round(random.uniform(2.5, 5.0), 2),  # avg_rating
                utc(ws),
            ))

    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO ward_health_scores
               (ward_id, composite_score, resolution_rate, avg_response_hrs, sla_breach_rate,
                grade, trend, score_delta_7d,
                total_complaints, resolved_complaints, overdue_complaints, overdue_count,
                avg_rating, calculated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING""",
            rows
        )
    print(f"✅ {len(rows)} ward health score rows seeded")

# ─── Seed weekly digests ──────────────────────────────────────────────────────

async def seed_weekly_digests(pool, wards, complaints):
    print("⏳ Seeding weekly digests (ward × zone × city × 13 weeks)…")

    from collections import defaultdict
    ward_week_complaints: dict[tuple, list] = defaultdict(list)
    for c in complaints:
        for weeks_ago in range(13):
            ws, we = week_bounds(weeks_ago)
            ws_dt  = utc(ws)
            we_dt  = utc(we) + timedelta(days=1)
            if ws_dt <= c["created_at"] < we_dt:
                ward_week_complaints[(c["ward_id"], ws)].append(c)
                break

    zone_wards: dict[str, list] = defaultdict(list)
    for w in wards:
        zone_wards[w["zone"]].append(w["ward_id"])

    digest_rows = []

    for weeks_ago in range(13):
        ws, we = week_bounds(weeks_ago)
        ws_dt  = utc(ws)
        we_dt  = utc(we) + timedelta(days=1)

        # Ward digests
        for w in wards:
            wid   = w["ward_id"]
            comps = ward_week_complaints[(wid, ws)]
            total    = len(comps)
            resolved = sum(1 for c in comps if c["status"] in STATUS_TERMINAL)
            pending  = total - resolved
            res_rate = round((resolved / max(total, 1)) * 100, 1)
            avg_hrs  = round(
                sum((c["resolved_at"] - c["created_at"]).total_seconds() / 3600
                    for c in comps if c.get("resolved_at")) /
                max(sum(1 for c in comps if c.get("resolved_at")), 1), 1
            )
            breaches    = sum(1 for c in comps if c["sla_breached"])
            score_start = round(float(w["health_score"]) + random.uniform(-5, 5), 2)
            score_end   = round(score_start + random.uniform(-3, 5), 2)
            top_cat     = (max(CATEGORIES, key=lambda cat: sum(1 for c in comps if c["category"] == cat))
                           if comps else "other")
            cat_json = category_breakdown_json(comps) if comps else "[]"
            urg_json = urgency_breakdown_json(comps)  if comps else "[]"
            summary  = (f"{w['ward_name']}: {total} complaints, "
                        f"{resolved} resolved ({res_rate:.0f}%) in week of {ws.strftime('%b %d')}.")
            achievements, concerns = build_achievements_concerns(
                res_rate, avg_hrs, score_start, score_end, breaches, total)

            digest_rows.append((
                "ward", wid, None,
                ws, we,
                total, resolved, pending, res_rate, avg_hrs, top_cat,
                cat_json, urg_json,
                score_start, score_end, round(score_end - score_start, 2),
                summary, summary,
                achievements, concerns,
                True, utc(we) + timedelta(days=1, hours=23),
            ))

        # Zone digests
        for zone, wids in zone_wards.items():
            zone_comps = [c for wid in wids for c in ward_week_complaints[(wid, ws)]]
            total    = len(zone_comps)
            resolved = sum(1 for c in zone_comps if c["status"] in STATUS_TERMINAL)
            pending  = total - resolved
            res_rate = round((resolved / max(total, 1)) * 100, 1)
            avg_hrs  = round(
                sum((c["resolved_at"] - c["created_at"]).total_seconds() / 3600
                    for c in zone_comps if c.get("resolved_at")) /
                max(sum(1 for c in zone_comps if c.get("resolved_at")), 1), 1
            )
            breaches    = sum(1 for c in zone_comps if c["sla_breached"])
            score_end   = round(random.uniform(45, 85), 2)
            score_start = round(score_end - random.uniform(-3, 5), 2)
            top_cat  = (max(CATEGORIES, key=lambda cat: sum(1 for c in zone_comps if c["category"] == cat))
                        if zone_comps else "other")
            cat_json = category_breakdown_json(zone_comps) if zone_comps else "[]"
            urg_json = urgency_breakdown_json(zone_comps)  if zone_comps else "[]"
            summary  = (f"{zone} Zone: {total} complaints, "
                        f"{resolved} resolved ({res_rate:.0f}%) for week of {ws.strftime('%b %d')}.")
            achievements, concerns = build_achievements_concerns(
                res_rate, avg_hrs, score_start, score_end, breaches, total)

            digest_rows.append((
                "zone", None, zone,
                ws, we,
                total, resolved, pending, res_rate, avg_hrs, top_cat,
                cat_json, urg_json,
                score_start, score_end, round(score_end - score_start, 2),
                summary, summary,
                achievements, concerns,
                True, utc(we) + timedelta(days=1, hours=23),
            ))

        # City digest
        all_comps = [c for c in complaints if utc(ws) <= c["created_at"] < we_dt]
        total    = len(all_comps)
        resolved = sum(1 for c in all_comps if c["status"] in STATUS_TERMINAL)
        pending  = total - resolved
        res_rate = round((resolved / max(total, 1)) * 100, 1)
        avg_hrs  = round(
            sum((c["resolved_at"] - c["created_at"]).total_seconds() / 3600
                for c in all_comps if c.get("resolved_at")) /
            max(sum(1 for c in all_comps if c.get("resolved_at")), 1), 1
        )
        breaches    = sum(1 for c in all_comps if c["sla_breached"])
        score_end   = round(random.uniform(55, 75), 2)
        score_start = round(score_end - random.uniform(-3, 4), 2)
        top_cat  = (max(CATEGORIES, key=lambda cat: sum(1 for c in all_comps if c["category"] == cat))
                    if all_comps else "other")
        cat_json = category_breakdown_json(all_comps) if all_comps else "[]"
        urg_json = urgency_breakdown_json(all_comps)  if all_comps else "[]"
        summary  = (f"MCD Delhi: {total} complaints across all wards, "
                    f"{resolved} resolved ({res_rate:.0f}%) for week of {ws.strftime('%b %d')}.")
        achievements, concerns = build_achievements_concerns(
            res_rate, avg_hrs, score_start, score_end, breaches, total)

        digest_rows.append((
            "city", None, None,
            ws, we,
            total, resolved, pending, res_rate, avg_hrs, top_cat,
            cat_json, urg_json,
            score_start, score_end, round(score_end - score_start, 2),
            summary, summary,
            achievements, concerns,
            True, utc(we) + timedelta(days=1, hours=23),
        ))

    ward_rows  = [r for r in digest_rows if r[0] == "ward"]
    other_rows = [r for r in digest_rows if r[0] != "ward"]

    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO weekly_digests
               (digest_type, ward_id, zone_name, week_start, week_end,
                total_complaints, resolved_complaints, pending_complaints,
                resolution_rate, avg_resolution_hours, top_category,
                category_breakdown, urgency_breakdown,
                health_score_start, health_score_end, score_change,
                summary_en, summary_hi, key_achievements, areas_of_concern,
                is_published, published_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
               ON CONFLICT (ward_id, week_start) DO UPDATE SET
                 total_complaints=EXCLUDED.total_complaints,
                 resolved_complaints=EXCLUDED.resolved_complaints,
                 pending_complaints=EXCLUDED.pending_complaints,
                 resolution_rate=EXCLUDED.resolution_rate,
                 avg_resolution_hours=EXCLUDED.avg_resolution_hours,
                 category_breakdown=EXCLUDED.category_breakdown,
                 urgency_breakdown=EXCLUDED.urgency_breakdown,
                 summary_en=EXCLUDED.summary_en,
                 is_published=TRUE""",
            ward_rows
        )
        await conn.executemany(
            """INSERT INTO weekly_digests
               (digest_type, ward_id, zone_name, week_start, week_end,
                total_complaints, resolved_complaints, pending_complaints,
                resolution_rate, avg_resolution_hours, top_category,
                category_breakdown, urgency_breakdown,
                health_score_start, health_score_end, score_change,
                summary_en, summary_hi, key_achievements, areas_of_concern,
                is_published, published_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
               ON CONFLICT DO NOTHING""",
            other_rows
        )

    print(f"✅ Weekly digests: {len(ward_rows)} ward, "
          f"{sum(1 for r in other_rows if r[0]=='zone')} zone, "
          f"{sum(1 for r in other_rows if r[0]=='city')} city rows")

# ─── MAIN ─────────────────────────────────────────────────────────────────────

async def main():
    print(f"\n{'='*60}")
    print("NagarMind — Full Database Reset & Seed (v7)")
    print(f"{'='*60}\n")

    pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)

    print("Step 1/9 — Drop all tables…")
    await drop_all_tables(pool)

    print("Step 2/9 — Create schema…")
    await create_schema(pool)

    print("Step 3/9 — Seed wards…")
    wards = await seed_wards(pool)

    print("Step 4/9 — Seed admins…")
    await seed_admins(pool)

    print("Step 5/9 — Seed officers…")
    officer_map = await seed_officers(pool, wards)

    print("Step 6/9 — Seed citizens…")
    citizen_map = await seed_citizens(pool, wards)

    print("Step 7/9 — Seed complaints + status history + messages…")
    complaints = await seed_complaints(pool, wards, citizen_map, officer_map)
    await seed_status_history(pool, complaints)
    await seed_messages(pool, complaints)

    print("Step 8/9 — Seed notifications…")
    await seed_notifications(pool, complaints)

    print("Step 8b/9 — Seed ward health scores…")
    await seed_health_scores(pool, wards)

    print("Step 9/9 — Seed weekly digests…")
    await seed_weekly_digests(pool, wards, complaints)

    await pool.close()

    print(f"\n{'='*60}")
    print("✅ DATABASE FULLY SEEDED")
    print(f"{'='*60}")
    print("""
CREDENTIALS:
  Admin:   MCD-ADMIN-001 / Admin@123!
  Officer: officer{ward_id}_1@mcd.delhi.gov.in / Officer@123!
  Citizen: citizen{ward_id}_1@test.com / TestPass@123

DATA:
  272 wards × 10 zones
  2 admins | 544 officers | 2720 citizens
  ~18,000 complaints across 13 weeks
  notifications, messages, health scores, weekly digests all seeded
""")

if __name__ == "__main__":
    asyncio.run(main())