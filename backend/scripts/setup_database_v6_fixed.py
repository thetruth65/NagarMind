# """
# NagarMind — Database Setup Script v6 FIXED
# Clears ALL tables then re-seeds fresh data with:
#   - 272 official MCD Delhi wards
#   - 10 citizens per ward (2720 total)
#   - 2 officers per ward (544 total)
#   - 500-600 complaints with proper SLA tracking
#   - Weekly digests with health scores
#   - Proper authentication support

# Run: python scripts/setup_database_v6_fixed.py
# """
# import asyncio
# import asyncpg
# import os
# import random
# import hashlib
# import bcrypt
# from datetime import datetime, timedelta, timezone
# from uuid import uuid4
# from dotenv import load_dotenv

# load_dotenv()

# # ─── SCHEMA WITH ALL FIXES ─────────────────────────────────────────────────────
# SCHEMA = """
# CREATE EXTENSION IF NOT EXISTS "pgcrypto";

# CREATE TABLE IF NOT EXISTS wards (
#     ward_id             SERIAL PRIMARY KEY,
#     ward_name           VARCHAR(120) NOT NULL,
#     zone                VARCHAR(60)  NOT NULL,
#     lat_center          DECIMAL(9,6),
#     lng_center          DECIMAL(9,6),
#     geojson_polygon     JSONB,
#     health_score        DECIMAL(5,2)  DEFAULT 50.0,
#     health_grade        CHAR(1)       DEFAULT 'C',
#     health_updated_at   TIMESTAMPTZ,
#     created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
# );

# CREATE TABLE IF NOT EXISTS otp_sessions (
#     phone_number        VARCHAR(15)  PRIMARY KEY,
#     otp_hash            VARCHAR(128) NOT NULL,
#     role                VARCHAR(20)  NOT NULL DEFAULT 'citizen',
#     expires_at          TIMESTAMPTZ  NOT NULL,
#     attempt_count       SMALLINT     NOT NULL DEFAULT 0,
#     used                BOOLEAN      NOT NULL DEFAULT FALSE,
#     created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
# );

# CREATE TABLE IF NOT EXISTS admins (
#     admin_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#     employee_id         VARCHAR(30)  UNIQUE NOT NULL,
#     full_name           VARCHAR(120) NOT NULL,
#     password_hash       VARCHAR(128) NOT NULL,
#     designation         VARCHAR(80)  DEFAULT 'Commissioner',
#     email               VARCHAR(120),
#     is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
#     last_login          TIMESTAMPTZ,
#     created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
# );

# CREATE TABLE IF NOT EXISTS citizens (
#     citizen_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#     phone_number        VARCHAR(15)  UNIQUE NOT NULL,
#     full_name           VARCHAR(120) NOT NULL,
#     ward_id             INT REFERENCES wards(ward_id),
#     home_address        TEXT,
#     preferred_language  VARCHAR(10)  NOT NULL DEFAULT 'en',
#     password_hash       VARCHAR(255) NOT NULL,
#     profile_photo_url   TEXT,
#     total_complaints    INT          NOT NULL DEFAULT 0,
#     is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
#     last_login          TIMESTAMPTZ,
#     created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
# );

# CREATE TABLE IF NOT EXISTS officers (
#     officer_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#     employee_id             VARCHAR(30)  UNIQUE NOT NULL,
#     phone_number            VARCHAR(15)  UNIQUE,
#     full_name               VARCHAR(120) NOT NULL,
#     password_hash           VARCHAR(128) NOT NULL,
#     designation             VARCHAR(80),
#     department              VARCHAR(80),
#     ward_id                 INT REFERENCES wards(ward_id),
#     zone                    VARCHAR(60),
#     preferred_language      VARCHAR(10)  NOT NULL DEFAULT 'en',
#     is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
#     is_admin                BOOLEAN      NOT NULL DEFAULT FALSE,
#     total_assigned          INT          NOT NULL DEFAULT 0,
#     total_resolved          INT          NOT NULL DEFAULT 0,
#     avg_resolution_hours    DECIMAL(8,2),
#     sla_compliance_rate     DECIMAL(5,2),
#     citizen_rating_avg      DECIMAL(4,3),
#     performance_score       DECIMAL(5,2),
#     current_lat             DECIMAL(9,6),
#     current_lng             DECIMAL(9,6),
#     location_updated_at     TIMESTAMPTZ,
#     last_login              TIMESTAMPTZ,
#     created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
# );

# CREATE TABLE IF NOT EXISTS complaints (
#     complaint_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#     citizen_id              UUID NOT NULL REFERENCES citizens(citizen_id),
#     ward_id                 INT  NOT NULL REFERENCES wards(ward_id),
#     assigned_officer_id     UUID REFERENCES officers(officer_id),
#     title                   VARCHAR(200) NOT NULL,
#     description             TEXT NOT NULL,
#     description_translated  TEXT,
#     original_language       VARCHAR(10)  NOT NULL DEFAULT 'en',
#     category                VARCHAR(50),
#     sub_category            VARCHAR(80),
#     department              VARCHAR(80),
#     urgency                 VARCHAR(20)  DEFAULT 'medium',
#     status                  VARCHAR(30)  NOT NULL DEFAULT 'submitted',
#     ai_summary              TEXT,
#     ai_category_confidence  DECIMAL(5,4),
#     photo_urls              TEXT[]       DEFAULT '{}',
#     audio_url               TEXT,
#     voice_transcript        TEXT,
#     location_lat            DECIMAL(9,6),
#     location_lng            DECIMAL(9,6),
#     location_address        TEXT,
#     location_hash           VARCHAR(32),
#     sla_hours               INT,
#     sla_deadline            TIMESTAMPTZ,
#     sla_breached            BOOLEAN      NOT NULL DEFAULT FALSE,
#     sla_breach_notified     BOOLEAN      NOT NULL DEFAULT FALSE,
#     is_duplicate            BOOLEAN      NOT NULL DEFAULT FALSE,
#     submitted_at            TIMESTAMPTZ,
#     assigned_at             TIMESTAMPTZ,
#     acknowledged_at         TIMESTAMPTZ,
#     resolved_at             TIMESTAMPTZ,
#     resolution_note         TEXT,
#     citizen_rating          SMALLINT,
#     citizen_feedback        TEXT,
#     disputed                BOOLEAN      NOT NULL DEFAULT FALSE,
#     dispute_reason          TEXT,
#     created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
#     updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
# );

# CREATE TABLE IF NOT EXISTS complaint_status_history (
#     history_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#     complaint_id    UUID NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
#     old_status      VARCHAR(30),
#     new_status      VARCHAR(30) NOT NULL,
#     changed_by_id   UUID,
#     changed_by_role VARCHAR(20),
#     note            TEXT,
#     created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
# );

# CREATE TABLE IF NOT EXISTS notifications (
#     notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#     user_id         UUID NOT NULL,
#     user_role       VARCHAR(20) NOT NULL,
#     complaint_id    UUID REFERENCES complaints(complaint_id) ON DELETE CASCADE,
#     type            VARCHAR(50) NOT NULL,
#     title           VARCHAR(200),
#     message         TEXT,
#     is_read         BOOLEAN NOT NULL DEFAULT FALSE,
#     created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
# );

# CREATE TABLE IF NOT EXISTS predictive_alerts (
#     alert_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#     ward_id         INT REFERENCES wards(ward_id),
#     alert_type      VARCHAR(50) NOT NULL,
#     severity        VARCHAR(20) NOT NULL DEFAULT 'medium',
#     title           VARCHAR(200),
#     description     TEXT,
#     narrative       TEXT,
#     evidence        JSONB,
#     is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
#     resolved_at     TIMESTAMPTZ,
#     created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
# );

# CREATE TABLE IF NOT EXISTS weekly_digests (
#     digest_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#     digest_type         VARCHAR(20) NOT NULL DEFAULT 'ward',
#     ward_id             INT REFERENCES wards(ward_id),
#     zone_name           VARCHAR(60),
#     week_start          DATE NOT NULL,
#     week_end            DATE NOT NULL,
#     total_complaints    INT  NOT NULL DEFAULT 0,
#     resolved_complaints INT  NOT NULL DEFAULT 0,
#     pending_complaints  INT  NOT NULL DEFAULT 0,
#     avg_resolution_hours DECIMAL(8,2),
#     resolution_rate     DECIMAL(5,2),
#     top_category        VARCHAR(50),
#     category_breakdown  JSONB,
#     urgency_breakdown   JSONB,
#     health_score_start  DECIMAL(5,2),
#     health_score_end    DECIMAL(5,2),
#     score_change        DECIMAL(5,2) DEFAULT 0,
#     summary_en          TEXT,
#     summary_hi          TEXT,
#     key_achievements    TEXT[] DEFAULT '{}',
#     areas_of_concern    TEXT[] DEFAULT '{}',
#     is_published        BOOLEAN NOT NULL DEFAULT TRUE,
#     published_at        TIMESTAMPTZ,
#     created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
#     -- FIX: Simple 2-column unique so ON CONFLICT (ward_id, week_start) works correctly.
#     -- digest_type defaults to 'ward' and zone_name is NULL for ward digests,
#     -- so a 4-column key with NULLs would never match. Use partial unique instead.
#     UNIQUE (ward_id, week_start)
# );

# CREATE TABLE IF NOT EXISTS ward_health_scores (
#     ward_id             INT REFERENCES wards(ward_id) ON DELETE CASCADE,
#     calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
#     score_date          DATE,
#     resolution_rate     DECIMAL(5,2),
#     overdue_count       INT,
#     composite_score     DECIMAL(5,2) NOT NULL,
#     grade               CHAR(1) NOT NULL,
#     trend               VARCHAR(20),
#     score_delta_7d      DECIMAL(5,2),
#     total_complaints    INT,
#     resolved_complaints INT,
#     overdue_complaints  INT,
#     avg_rating          DECIMAL(4,3),
#     PRIMARY KEY (ward_id, calculated_at)
# );

# CREATE TABLE IF NOT EXISTS ai_classification_logs (
#     log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#     complaint_id    UUID REFERENCES complaints(complaint_id) ON DELETE CASCADE,
#     raw_response    JSONB,
#     created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
# );

# CREATE INDEX IF NOT EXISTS idx_complaints_ward        ON complaints(ward_id, created_at DESC);
# CREATE INDEX IF NOT EXISTS idx_complaints_officer     ON complaints(assigned_officer_id, status);
# CREATE INDEX IF NOT EXISTS idx_complaints_status      ON complaints(status, created_at DESC);
# CREATE INDEX IF NOT EXISTS idx_complaints_created     ON complaints(created_at DESC);
# CREATE INDEX IF NOT EXISTS idx_complaints_citizen     ON complaints(citizen_id, created_at DESC);
# CREATE INDEX IF NOT EXISTS idx_complaints_category    ON complaints(category, created_at DESC);
# CREATE INDEX IF NOT EXISTS idx_notifs_user            ON notifications(user_id, is_read, created_at DESC);
# CREATE INDEX IF NOT EXISTS idx_notifs_created         ON notifications(created_at DESC);
# CREATE INDEX IF NOT EXISTS idx_alerts_ward            ON predictive_alerts(ward_id, is_resolved);
# CREATE INDEX IF NOT EXISTS idx_digests_ward           ON weekly_digests(ward_id, week_start DESC);
# """

# # ─── DATA CONSTANTS ────────────────────────────────────────────────────────────
# WARD_DATA = [
#     ("Adarsh Nagar","North"),("Aditi","North-West"),("Ambedkar Nagar","South"),
#     ("Anand Parbat","Central"),("Anand Vihar","East"),("Ashok Nagar","East"),
#     ("Adarsh Nagar","North"),("Azad Market","Central"),("Badli","North"),
#     ("Bawana","North"),("Begumpur","North-West"),("Bijwasan","South-West"),
#     ("Bindapur","West"),("Brijpuri","North-East"),("Brahmpuri","North-East"),
#     ("Burari","North"),("Chanakyapuri","New Delhi"),("Chandni Chowk","Central"),
#     ("Chattarpur","South"),("Civil Lines","North"),("Dakshini Pitampura","North"),
#     ("Dashrath Puri","West"),("Dayalpur","North-East"),("Defence Colony","South"),
#     ("Delhi Cantt","South-West"),("Delhi Gate","Central"),("Deoli","South"),
#     ("Devli","South"),("Dwarka","South-West"),("Dwarka Sector 1","South-West"),
#     ("Dwarka Sector 10","South-West"),("Dwarka Sector 11","South-West"),
#     ("Dwarka Sector 12","South-West"),("Dwarka Sector 13","South-West"),
#     ("Dwarka Sector 14","South-West"),("Dwarka Sector 16","South-West"),
#     ("Dwarka Sector 17","South-West"),("Dwarka Sector 18","South-West"),
#     ("Dwarka Sector 19","South-West"),("Dwarka Sector 2","South-West"),
#     ("Dwarka Sector 22","South-West"),("Fateh Nagar","West"),
#     ("Gagan Vihar","East"),("Gandhinagar","East"),("Geeta Colony","East"),
#     ("Gokalpur","North-East"),("Greater Kailash","South"),("Green Park","South"),
#     ("Hari Nagar","West"),("Harinagar","West"),("Harsh Vihar","North-East"),
#     ("Hauz Khas","South"),("Hauz Qazi","Central"),("Inderlok","North"),
#     ("Inderpuri","West"),("Jaffrabad","North-East"),("Jangpura","South"),
#     ("Janpath","New Delhi"),("Jasola","South"),("Johripur","North-East"),
#     ("Kalkaji","South"),("Kalyan Vihar","North"),("Karawal Nagar","North-East"),
#     ("Kardam Puri","North-East"),("Karol Bagh","Central"),("Keshav Puram","North"),
#     ("Khichripur","East"),("Khyala","West"),("Kirari","North-West"),
#     ("Kondli","East"),("Krishna Nagar","East"),("Lal Kuan","Central"),
#     ("Laxmi Nagar","East"),("Madipur","West"),("Madanpur Khadar","South"),
#     ("Malviya Nagar","South"),("Mandawali","East"),("Mangolpuri","North-West"),
#     ("Maujpur","North-East"),("Mehrauli","South"),("Model Town","North"),
#     ("Moti Nagar","West"),("Mukherjee Nagar","North"),("Mundka","West"),
#     ("Mustafabad","North-East"),("Nabi Karim","Central"),("Najafgarh","South-West"),
#     ("Nangloi","West"),("Naraina","West"),("Narela","North"),
#     ("Nathupur","North"),("Nehru Vihar","North"),("New Delhi","New Delhi"),
#     ("Nihal Vihar","West"),("Nilothi","West"),("Okhla","South"),
#     ("Palam","South-West"),("Patel Nagar","Central"),("Patparganj","East"),
#     ("Pitampura","North-West"),("Prashant Vihar","North"),("Pulbangash","Central"),
#     ("Punjabi Bagh","West"),("Pusa","Central"),("Qutab Nagar","North"),
#     ("Rajouri Garden","West"),("Rithala","North-West"),("Rohini","North-West"),
#     ("Rohini Sector 15","North-West"),("Rohini Sector 16","North-West"),
#     ("Rohini Sector 17","North-West"),("Rohini Sector 18","North-West"),
#     ("Rohini Sector 19","North-West"),("Rohini Sector 21","North-West"),
#     ("Rohini Sector 24","North-West"),("Rohini Sector 25","North-West"),
#     ("Rohini Sector 26","North-West"),("Rohini Sector 27","North-West"),
#     ("Sadar Bazar","Central"),("Saket","South"),("Sangam Vihar","South"),
#     ("Sant Nagar","North"),("Saraswati Vihar","North-West"),("Seelampur","North-East"),
#     ("Seemapuri","North-East"),("Shahdara","North-East"),("Shakti Nagar","North"),
#     ("Shakurpur","North-West"),("Shalimar Bagh","North-West"),("Shastri Nagar","North"),
#     ("Sriniwaspuri","South"),("Sultanpuri","North-West"),("Tilak Nagar","West"),
#     ("Timarpur","North"),("Tri Nagar","North-West"),("Tughlakabad","South"),
#     ("Uttam Nagar","West"),("Vasant Kunj","South"),("Vasant Vihar","South"),
#     ("Vijay Nagar","North"),("Vikaspuri","West"),("Vishwas Nagar","East"),
#     ("Vivek Vihar","East"),("Wazirpur","North"),("Yamuna Vihar","North-East"),
# ]

# ZONES = ["North","North-West","North-East","Shahdara","East",
#          "New Delhi","Central","West","South-West","South"]

# DEPARTMENTS = ["Roads & Infrastructure","Sanitation","Drainage",
#                "Electrical / Street Lighting","Horticulture / Parks",
#                "Water Supply","Building & Property","Health","Community Welfare"]

# DESIGNATIONS = ["Junior Engineer (JE)","Assistant Engineer (AE)",
#                 "Executive Engineer (EE)","Sanitation Inspector",
#                 "Health Inspector","Sub-Divisional Officer (SDO)","Ward Officer"]

# CATEGORIES = ["roads_and_footpaths","sanitation_and_garbage","drainage_and_flooding",
#                "street_lighting","parks_and_gardens","water_supply",
#                "illegal_construction","noise_and_pollution","stray_animals"]

# COMPLAINT_TITLES = {
#     "roads_and_footpaths": [
#         "Large pothole on main road causing accidents",
#         "Damaged footpath needs urgent repair",
#         "Road cave-in after rainfall",
#         "Speed breaker broken and dangerous",
#         "Road markings faded completely",
#     ],
#     "sanitation_and_garbage": [
#         "Garbage not collected for 3 days",
#         "Overflowing dustbin near market",
#         "Open garbage dump attracting animals",
#         "Littering on residential street",
#         "Garbage burning causing air pollution",
#     ],
#     "drainage_and_flooding": [
#         "Drain blocked causing waterlogging",
#         "Sewage overflow on residential road",
#         "Storm drain choked with debris",
#         "Manhole cover missing — safety hazard",
#         "Basement flooding after rain",
#     ],
#     "street_lighting": [
#         "Street light not working for 2 weeks",
#         "Multiple lights out in colony",
#         "Broken electric pole on road",
#         "Flickering street light causing accidents",
#         "New area has no street lighting",
#     ],
#     "parks_and_gardens": [
#         "Park benches broken and damaged",
#         "Grass not maintained for months",
#         "Park lights not working",
#         "Children's play equipment broken",
#         "Encroachment in public park",
#     ],
#     "water_supply": [
#         "No water supply for 2 days",
#         "Contaminated water from tap",
#         "Low water pressure in building",
#         "Water pipe leaking on street",
#         "Water tanker not arriving on schedule",
#     ],
#     "illegal_construction": [
#         "Illegal construction blocking road",
#         "Building without permission near park",
#         "Encroachment on public footpath",
#         "Commercial construction in residential area",
#         "Unauthorized extension causing damage",
#     ],
#     "noise_and_pollution": [
#         "Factory noise disturbing residents at night",
#         "Open burning of waste near homes",
#         "Construction noise after 10 PM",
#         "DJ system during prohibited hours",
#         "Air pollution from nearby facility",
#     ],
#     "stray_animals": [
#         "Pack of stray dogs attacking pedestrians",
#         "Stray cattle blocking traffic",
#         "Monkeys damaging property",
#         "Stray dogs near school — safety issue",
#         "Injured stray animal needs rescue",
#     ],
# }

# URGENCY_WEIGHTS = ["low"] * 10 + ["medium"] * 50 + ["high"] * 30 + ["critical"] * 10
# SLA_HOURS = {"critical": 24, "high": 48, "medium": 72, "low": 120}

# STATUS_PROGRESSION = [
#     ("submitted",    8),
#     ("assigned",    15),
#     ("acknowledged",15),
#     ("in_progress", 20),
#     ("resolved",    30),
#     ("closed",      12),
# ]

# CITIZEN_PREFIXES = ["Rajesh","Priya","Amit","Sunita","Vikram","Anita","Sanjay",
#     "Kavita","Deepak","Meera","Rohit","Pooja","Arun","Sneha","Manoj","Rekha",
#     "Vivek","Geeta","Suresh","Neha","Ajay","Ritu","Naveen","Sheela","Tarun",
#     "Preeti","Hemant","Vandana","Rakesh","Uma","Ganesh","Lalita","Sameer",
#     "Farida","Ashok","Smita","Pankaj","Anjali","Kiran","Harish"]

# CITIZEN_SUFFIXES = ["Kumar","Sharma","Singh","Verma","Gupta","Patel","Mehta",
#     "Nair","Joshi","Agarwal","Khanna","Malhotra","Mishra","Chaudhary","Yadav",
#     "Sinha","Pandey","Saxena","Tiwari","Kapoor","Bhatia","Goel","Dubey","Arora",
#     "Bajaj","Chauhan","Shukla","Srivastava","Prasad","Rao","Devi","Khan","Begum",
#     "Jain","Dixit","Tripathi","Banerjee","Bedi","Rawat"]

# OFFICER_PREFIXES = ["Ram","Vinod","Sushil","Anil","Rajendra","Mukesh","Harish",
#     "Sunil","Prem","Ramesh","Girish","Satish","Kamlesh","Bharat","Naresh",
#     "Surendra","Dinesh","Mahesh","Umesh","Lokesh","Devendra","Rakesh","Kishore",
#     "Pramod","Suresh","Alok","Anand","Vinay","Sanjay","Hemant","Rajan","Vijay"]

# OFFICER_SUFFIXES = ["Prakash","Kumar","Sharma","Gupta","Singh","Yadav","Chandra",
#     "Mishra","Chand","Verma","Pandey","Patel","Bhushan","Joshi","Nath","Aggarwal",
#     "Pandya","Lal","Misra","Babu","Srivastava","Pal","Shankar","Datta","Saxena"]


# def hash_pwd(password: str) -> str:
#     return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt(rounds=10)).decode()


# def delhi_coords(zone: str) -> tuple:
#     zone_bounds = {
#         "North":      (28.70, 28.85, 77.10, 77.25),
#         "North-West": (28.68, 28.80, 77.05, 77.18),
#         "North-East": (28.67, 28.80, 77.25, 77.35),
#         "Shahdara":   (28.65, 28.75, 77.28, 77.35),
#         "East":       (28.60, 28.72, 77.28, 77.35),
#         "New Delhi":  (28.58, 28.65, 77.18, 77.25),
#         "Central":    (28.63, 28.70, 77.20, 77.28),
#         "West":       (28.62, 28.73, 77.05, 77.18),
#         "South-West": (28.54, 28.64, 76.98, 77.10),
#         "South":      (28.50, 28.62, 77.18, 77.28),
#     }
#     bounds = zone_bounds.get(zone, (28.55, 28.78, 77.05, 77.30))
#     lat = round(random.uniform(bounds[0], bounds[1]), 6)
#     lng = round(random.uniform(bounds[2], bounds[3]), 6)
#     return lat, lng


# def get_location_hash(lat: float, lng: float) -> str:
#     """Generate location hash for duplicate detection"""
#     rounded = f"{lat:.4f},{lng:.4f}"
#     return hashlib.md5(rounded.encode()).hexdigest()[:8]


# def get_272_wards():
#     wards = list(WARD_DATA)
#     extra_zones = list(ZONES)
#     while len(wards) < 272:
#         i = len(wards)
#         zone = extra_zones[i % len(extra_zones)]
#         suffixes = ["Block A","Block B","Block C","Extension","Phase 1","Phase 2",
#                     "Phase 3","Enclave","Colony","Nagar","Vihar","Garden","Park"]
#         base_names = ["Sundar","Shanti","Pragati","Lok","Jan","Nav","Suraj","Chandra"]
#         name = f"{random.choice(base_names)} {random.choice(suffixes)} ({zone[:3]})"
#         wards.append((name, zone))
#     return wards[:272]


# def random_date_in_last_30_days() -> datetime:
#     days_ago = random.uniform(0, 30)
#     dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
#     dt = dt.replace(
#         hour=random.randint(6, 22),
#         minute=random.randint(0, 59),
#         second=random.randint(0, 59),
#     )
#     return dt


# async def drop_all_tables(conn):
#     tables = [
#         "ai_classification_logs", "ward_health_scores", "weekly_digests",
#         "predictive_alerts", "notifications", "complaint_status_history",
#         "complaints", "otp_sessions", "officers", "citizens", "admins", "wards",
#     ]
#     for t in tables:
#         await conn.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
#     print("  ✓ All tables dropped")


# async def setup(pool):
#     NOW = datetime.now(timezone.utc)

#     # ── 0. DROP + RECREATE ───────────────────────────────────────────────────
#     print("\n🗑️  Clearing all tables...")
#     async with pool.acquire() as conn:
#         await drop_all_tables(conn)

#     print("\n📐 Creating schema...")
#     async with pool.acquire() as conn:
#         for stmt in [s.strip() for s in SCHEMA.split(';') if s.strip()]:
#             try:
#                 await conn.execute(stmt)
#             except Exception as e:
#                 if 'already exists' not in str(e).lower():
#                     print(f"  ⚠  {stmt[:80]}… → {e}")
#     print("  ✓ Schema ready")

#     # ── 1. WARDS ─────────────────────────────────────────────────────────────
#     print("\n🗺️  Seeding 272 MCD Delhi wards...")
#     wards_data = get_272_wards()
#     ward_ids = []
#     async with pool.acquire() as conn:
#         for name, zone in wards_data:
#             lat, lng = delhi_coords(zone)
#             score = round(random.uniform(30, 90), 2)
#             grade = 'A' if score >= 80 else 'B' if score >= 65 else 'C' if score >= 50 else 'D' if score >= 35 else 'F'
#             wid = await conn.fetchval(
#                 """INSERT INTO wards (ward_name, zone, lat_center, lng_center, health_score, health_grade)
#                    VALUES ($1,$2,$3,$4,$5,$6) RETURNING ward_id""",
#                 name, zone, lat, lng, score, grade
#             )
#             ward_ids.append((wid, zone))
#     print(f"  ✓ {len(ward_ids)} wards seeded")

#     # ── 2. ADMINS ────────────────────────────────────────────────────────────
#     print("\n👑 Seeding 2 admin accounts...")
#     admins = [
#         ("MCD-ADMIN-001", "Mohit Sharma",   "Admin@123!", "Commissioner"),
#         ("MCD-ADMIN-002", "Priya Kapoor",   "Admin@456!", "Joint Commissioner"),
#     ]
#     admin_ids = []
#     async with pool.acquire() as conn:
#         for emp, name, pwd, desig in admins:
#             aid = await conn.fetchval(
#                 """INSERT INTO admins (employee_id, full_name, password_hash, designation)
#                    VALUES ($1,$2,$3,$4) RETURNING admin_id""",
#                 emp, name, hash_pwd(pwd), desig
#             )
#             admin_ids.append(aid)
#             print(f"  ✓ {emp} / {pwd}")

#     # ── 3. OFFICERS (2 per ward = 544 total) ──────────────────────────────────
#     print("\n👮 Seeding 2 officers per ward (544 total)...")
#     officer_ids = []
#     officer_ward_map = {}
#     async with pool.acquire() as conn:
#         officer_count = 0
#         for wid, zone in ward_ids:
#             for j in range(2):
#                 officer_count += 1
#                 name = f"{random.choice(OFFICER_PREFIXES)} {random.choice(OFFICER_SUFFIXES)}"
#                 emp_id = f"MCD{2024*10000 + officer_count:08d}"
#                 desig = DESIGNATIONS[officer_count % len(DESIGNATIONS)]
#                 dept = DEPARTMENTS[officer_count % len(DEPARTMENTS)]
#                 sla_rate = round(random.uniform(55, 98), 2)
#                 rating = round(random.uniform(3.2, 5.0), 3)
#                 perf_score = round((sla_rate * 0.6 + rating * 8), 2)

#                 oid = await conn.fetchval(
#                     """INSERT INTO officers
#                        (employee_id, full_name, password_hash, designation, department,
#                         ward_id, zone, sla_compliance_rate, citizen_rating_avg, performance_score,
#                         total_assigned, total_resolved)
#                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING officer_id""",
#                     emp_id, name, hash_pwd("Officer@123!"), desig, dept,
#                     wid, zone, sla_rate, rating, perf_score,
#                     random.randint(10, 80), random.randint(5, 60)
#                 )
#                 officer_ids.append(oid)
#                 officer_ward_map[oid] = wid
#     print(f"  ✓ {officer_count} officers seeded — all password: Officer@123!")

#     # ── 4. CITIZENS (10 per ward = 2720 total) ────────────────────────────────
#     print("\n👤 Seeding 10 citizens per ward (2720 total)...")
#     citizen_ids = []
#     # Hash the test password once for all citizens
#     test_password_hash = hash_pwd("TestPass@123")
#     async with pool.acquire() as conn:
#         citizen_count = 0
#         for wid, zone in ward_ids:
#             for j in range(10):
#                 citizen_count += 1
#                 name = f"{random.choice(CITIZEN_PREFIXES)} {random.choice(CITIZEN_SUFFIXES)}"
#                 phone = f"9{random.randint(100000000, 999999999)}"
#                 cid = await conn.fetchval(
#                     """INSERT INTO citizens (phone_number, full_name, password_hash, ward_id, preferred_language)
#                        VALUES ($1,$2,$3,$4,'en') RETURNING citizen_id""",
#                     phone, name, test_password_hash, wid
#                 )
#                 citizen_ids.append((cid, wid))
#     print(f"  ✓ {citizen_count} citizens seeded — all password: TestPass@123")

#     # ── 5. COMPLAINTS (550 spread over 30 days) ───────────────────────────────
#     print("\n📋 Seeding 550 complaints with proper SLA tracking...")
#     complaint_ids = []
#     status_pool = []
#     for status, pct in STATUS_PROGRESSION:
#         status_pool.extend([status] * pct)

#     # Build a lookup: ward_id → zone string (for coord generation)
#     ward_zone_lookup = {wid: zone for wid, zone in ward_ids}

#     async with pool.acquire() as conn:
#         for i in range(550):
#             cid, c_ward_id = random.choice(citizen_ids)
#             category = random.choice(CATEGORIES)
#             title = random.choice(COMPLAINT_TITLES[category])
#             urgency = random.choice(URGENCY_WEIGHTS)
#             status = random.choice(status_pool)
#             created_at = random_date_in_last_30_days()
#             sla_hours = SLA_HOURS[urgency]
#             sla_deadline = created_at + timedelta(hours=sla_hours)

#             resolved_at = None
#             if status in ('resolved', 'closed'):
#                 hours = random.uniform(2, sla_hours * 1.5)
#                 resolved_at = created_at + timedelta(hours=hours)

#             sla_breached = (
#                 status not in ('resolved', 'closed') and
#                 datetime.now(timezone.utc) > sla_deadline
#             )

#             ward_officers = [oid for oid, wid in officer_ward_map.items() if wid == c_ward_id]
#             assigned_officer_id = (
#                 random.choice(ward_officers)
#                 if ward_officers and status != 'submitted'
#                 else None
#             )

#             zone_str = ward_zone_lookup.get(c_ward_id, "Central")
#             lat, lng = delhi_coords(zone_str)
#             location_hash = get_location_hash(lat, lng)

#             rating = (
#                 random.randint(1, 5)
#                 if status in ('resolved', 'closed') and random.random() > 0.3
#                 else None
#             )

#             comp_id = await conn.fetchval(
#                 """INSERT INTO complaints
#                    (citizen_id, ward_id, assigned_officer_id, title, description,
#                     category, urgency, status, sla_hours, sla_deadline, sla_breached,
#                     sla_breach_notified, is_duplicate,
#                     location_lat, location_lng, location_hash,
#                     resolved_at, citizen_rating,
#                     created_at, updated_at, submitted_at)
#                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19,$20)
#                    RETURNING complaint_id""",
#                 cid, c_ward_id, assigned_officer_id,
#                 title,
#                 f"Complaint regarding {title.lower()} in our locality. Needs urgent attention from MCD officials.",
#                 category, urgency, status,
#                 sla_hours, sla_deadline, sla_breached,
#                 False, False,  # sla_breach_notified, is_duplicate
#                 lat, lng, location_hash,
#                 resolved_at, rating,
#                 created_at,       # created_at  ($19 used twice via $19,$19)
#                 created_at,       # submitted_at ($20)
#             )
#             complaint_ids.append(comp_id)

#             # Update citizen total_complaints count
#             await conn.execute(
#                 "UPDATE citizens SET total_complaints = total_complaints + 1 WHERE citizen_id = $1",
#                 cid
#             )

#             if status != 'submitted':
#                 await conn.execute(
#                     """INSERT INTO complaint_status_history
#                        (complaint_id, old_status, new_status, changed_by_role, created_at)
#                        VALUES ($1,'submitted',$2,'officer',$3)""",
#                     comp_id, status, created_at + timedelta(hours=random.uniform(1, 12))
#                 )

#     total = await pool.fetchval("SELECT COUNT(*) FROM complaints")
#     print(f"  ✓ {total} complaints seeded")

#     # ── 6. WARD HEALTH RECALCULATION ─────────────────────────────────────────
#     print("\n🏥 Recalculating ward health scores from complaint data...")
#     async with pool.acquire() as conn:
#         ward_rows = await conn.fetch("SELECT ward_id FROM wards")
#         for row in ward_rows:
#             wid = row['ward_id']
#             stats = await conn.fetchrow(
#                 """SELECT
#                      COUNT(*) AS total,
#                      COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved,
#                      COUNT(*) FILTER (WHERE sla_breached AND status NOT IN ('resolved','closed')) AS breached,
#                      COUNT(*) FILTER (WHERE is_duplicate = TRUE) AS duplicates,
#                      AVG(citizen_rating) FILTER (WHERE citizen_rating IS NOT NULL) AS avg_rating
#                    FROM complaints WHERE ward_id=$1""", wid
#             )
#             total_c = stats['total'] or 0
#             resolved_c = stats['resolved'] or 0
#             breached_c = stats['breached'] or 0
#             dupl_c = stats['duplicates'] or 0
#             avg_r = float(stats['avg_rating'] or 3.5)

#             if total_c == 0:
#                 score = round(random.uniform(40, 70), 2)
#             else:
#                 res_rate = resolved_c / total_c
#                 breach_penalty = min(breached_c * 3, 30)
#                 dupl_penalty = min(dupl_c * 2, 10)
#                 score = round(max(10, min(100, res_rate * 70 + avg_r * 6 - breach_penalty - dupl_penalty)), 2)

#             grade = 'A' if score >= 80 else 'B' if score >= 65 else 'C' if score >= 50 else 'D' if score >= 35 else 'F'
#             await conn.execute(
#                 "UPDATE wards SET health_score=$1, health_grade=$2, health_updated_at=NOW() WHERE ward_id=$3",
#                 score, grade, wid
#             )
#     print("  ✓ Ward health scores updated")

#     # ── 7. WEEKLY DIGESTS (last 4 weeks) ──────────────────────────────────────
#     print("\n📊 Generating weekly digests (last 4 weeks)...")
#     today = datetime.now(timezone.utc).date()
#     last_monday = today - timedelta(days=today.weekday())

#     digest_count = 0
#     async with pool.acquire() as conn:
#         top_wards = await conn.fetch("SELECT ward_id, ward_name, health_score FROM wards LIMIT 30")

#         for week_offset in range(4):
#             week_start_date = last_monday - timedelta(weeks=week_offset + 1)
#             week_end_date = week_start_date + timedelta(days=6)

#             # Use timezone-aware datetimes for PostgreSQL TIMESTAMPTZ comparisons
#             week_start_dt = datetime.combine(week_start_date, datetime.min.time(), tzinfo=timezone.utc)
#             week_end_dt_plus_one = datetime.combine(week_end_date, datetime.min.time(), tzinfo=timezone.utc) + timedelta(days=1)

#             for ward_row in top_wards:
#                 wid = ward_row['ward_id']
#                 wname = ward_row['ward_name']
#                 health_start = float(ward_row['health_score'])

#                 stats = await conn.fetchrow(
#                     """SELECT
#                          COUNT(*) AS total,
#                          COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved,
#                          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)
#                            FILTER (WHERE resolved_at IS NOT NULL) AS avg_hours,
#                          mode() WITHIN GROUP (ORDER BY category) AS top_cat
#                        FROM complaints
#                        WHERE ward_id=$1
#                          AND created_at >= $2
#                          AND created_at < $3""",
#                     wid,
#                     week_start_dt,
#                     week_end_dt_plus_one,
#                 )

#                 total_c = stats['total'] or random.randint(2, 15)
#                 resolved_c = stats['resolved'] or random.randint(1, total_c)
#                 avg_h = float(stats['avg_hours'] or random.uniform(12, 96))
#                 top_cat = stats['top_cat'] or random.choice(CATEGORIES)
#                 res_rate = round((resolved_c / total_c) * 100, 2) if total_c > 0 else 0
#                 score_change = round(random.uniform(-8, 12), 2)
#                 health_end = round(float(health_start) + score_change, 2)

#                 summary = (
#                     f"This week, {wname} ward reported {total_c} civic complaints. "
#                     f"{resolved_c} were resolved ({res_rate:.0f}% resolution rate). "
#                     f"Average resolution time was {avg_h:.0f} hours. "
#                     f"Most common issue: {top_cat.replace('_', ' ').title()}."
#                 )

#                 try:
#                     # FIX: ON CONFLICT now matches the 2-column UNIQUE (ward_id, week_start)
#                     await conn.execute(
#                         """INSERT INTO weekly_digests
#                            (ward_id, week_start, week_end, total_complaints,
#                             resolved_complaints, pending_complaints, avg_resolution_hours,
#                             resolution_rate, top_category, health_score_start, health_score_end,
#                             score_change, summary_en, is_published)
#                            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE)
#                            ON CONFLICT (ward_id, week_start) DO UPDATE SET
#                                summary_en        = EXCLUDED.summary_en,
#                                health_score_end  = EXCLUDED.health_score_end,
#                                score_change      = EXCLUDED.score_change,
#                                is_published      = TRUE,
#                                published_at      = NOW()""",
#                         wid, week_start_date, week_end_date, total_c,
#                         resolved_c, total_c - resolved_c,
#                         round(avg_h, 2), res_rate, top_cat,
#                         health_start, health_end, score_change, summary,
#                     )
#                     digest_count += 1
#                 except Exception as e:
#                     print(f"  ⚠  Digest insert failed ward={wid} week={week_start_date}: {e}")

#     print(f"  ✓ {digest_count} weekly digest records created")

#     # ── 8. DEMO ALERTS ───────────────────────────────────────────────────────
#     print("\n🔔 Seeding demo alerts...")
#     alert_data = [
#         (ward_ids[0][0], "critical", "Severe waterlogging reported",
#          "Multiple complaints about flooding in the ward after recent rainfall."),
#         (ward_ids[1][0], "high", "Garbage collection disrupted",
#          "Waste pickup missed for 4 consecutive days in this area."),
#         (ward_ids[2][0], "medium", "Street lighting failure",
#          "Over 20 street lights reported non-functional this week."),
#         (ward_ids[3][0], "low", "Park maintenance overdue",
#          "Residents report grass uncut and benches damaged."),
#     ]
#     async with pool.acquire() as conn:
#         for wid, sev, title, desc in alert_data:
#             await conn.execute(
#                 """INSERT INTO predictive_alerts
#                    (ward_id, alert_type, severity, title, description, is_resolved)
#                    VALUES ($1,'admin_alert',$2,$3,$4,FALSE)""",
#                 wid, sev, title, desc
#             )
#     print("  ✓ 4 demo alerts created")

#     # ── SUMMARY ───────────────────────────────────────────────────────────────
#     total_comp = await pool.fetchval("SELECT COUNT(*) FROM complaints")
#     print(f"""
# {'='*60}
# 🚀 NagarMind Database Ready - FIXED VERSION!
# {'='*60}
#   Wards:       {await pool.fetchval("SELECT COUNT(*) FROM wards")}
#   Admins:      2
#                MCD-ADMIN-001 / Admin@123!
#                MCD-ADMIN-002 / Admin@456!
#   Officers:    {await pool.fetchval("SELECT COUNT(*) FROM officers")} (2 per ward, all: Officer@123!)
#   Citizens:    {await pool.fetchval("SELECT COUNT(*) FROM citizens")} (10 per ward)
#   Complaints:  {total_comp} (spread over last 30 days)
  
#   Digests:     {await pool.fetchval("SELECT COUNT(*) FROM weekly_digests")} weekly digest records
#   Alerts:      {await pool.fetchval("SELECT COUNT(*) FROM predictive_alerts")}

# Key Fixes Applied:
#   ✅ Added voice_transcript TEXT column to complaints
#   ✅ Added submitted_at TIMESTAMPTZ to complaints
#   ✅ Added evidence JSONB column to predictive_alerts
#   ✅ photo_urls defaults to '' (no null issues on insert)
#   ✅ weekly_digests UNIQUE simplified to (ward_id, week_start)
#   ✅ ON CONFLICT in digest seeding now matches correct key
#   ✅ Ward zone lookup uses dict instead of generator (correct)
#   ✅ Timezone-aware datetimes used throughout seeding

# Next steps:
#   1. cd backend && python scripts/setup_database_v6_fixed.py
#   2. cd backend && uvicorn main:app --reload --port 8000
#   3. cd frontend && npm run dev
#   4. Admin:   /officer/auth  →  MCD-ADMIN-001 / Admin@123!
#   5. Officer: /officer/auth  →  MCD202400001 / Officer@123!
#   6. Citizen: /citizen/auth  →  any 10-digit number / TestPass@123
# {'='*60}
# """)


# async def main():
#     db_url = os.getenv("DATABASE_URL_SYNC") or os.getenv("DATABASE_URL", "")
#     if not db_url:
#         print("❌ DATABASE_URL or DATABASE_URL_SYNC not set in .env")
#         print("   Add: DATABASE_URL_SYNC=postgresql://user:pass@host/dbname")
#         return
#     db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
#     print(f"Connecting to database...")
#     pool = await asyncpg.create_pool(db_url, min_size=1, max_size=3, ssl="require")
#     try:
#         await setup(pool)
#     finally:
#         await pool.close()


# if __name__ == "__main__":
#     asyncio.run(main())


"""
NagarMind — Complete Database Setup & Seed Script (v7)
=======================================================

WHAT THIS SCRIPT DOES:
  1. Drops and recreates ALL tables with correct schema
  2. Seeds 272 Delhi wards across 10 zones
  3. Seeds 2 admins + 544 officers (2 per ward) with phones
  4. Seeds 2720 citizens (10 per ward) with full profiles
  5. Seeds 2720+ complaints (correct category keys, multi-status, multi-week spread)
  6. Seeds complaint_status_history (full pipeline: submitted→assigned→acknowledged→in_progress→resolved)
  7. Seeds notifications for officers AND citizens (inbox populated)
  8. Seeds ward_health_scores (weekly, 12 weeks back)
  9. Seeds weekly_digests:
       - ward level:  ALL 272 wards × 12 weeks (past) + current running week
       - zone level:  10 zones × 12 weeks + current week
       - city level:  13 weeks total
  10. Seeds complaint_messages (officer↔citizen communication per complaint)

CATEGORIES (matching complaint_pipeline.py SLA_TABLE):
  pothole, garbage, sewage, water_supply, streetlight,
  tree, stray_animals, encroachment, noise, other

URGENCY LEVELS: critical, high, medium, low
STATUS PIPELINE: submitted → assigned → acknowledged → in_progress → resolved / closed

RUN:
  cd backend
  python scripts/setup_database_v6_fixed.py
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

CATEGORIES   = ["pothole", "garbage", "sewage", "water_supply", "streetlight",
                "tree", "stray_animals", "encroachment", "noise", "other"]

URGENCY_LEVELS = ["critical", "high", "medium", "low"]
URGENCY_WEIGHTS = [0.10, 0.25, 0.45, 0.20]

SLA_HOURS = {
    "pothole": 48, "garbage": 24, "sewage": 12, "water_supply": 24,
    "streetlight": 72, "tree": 96, "stray_animals": 48,
    "encroachment": 120, "noise": 24, "other": 72,
}

STATUS_PIPELINE  = ["submitted", "assigned", "acknowledged", "in_progress", "resolved"]
STATUS_TERMINAL  = {"resolved", "closed"}

ZONES = [
    "Central", "City SP", "Civil Lines", "Keshavpuram",
    "Najafgarh", "Narela", "Rohini", "Sadar Paharganj",
    "Shahdara North", "Shahdara South",
]

# ─── Delhi Ward Data (272 wards across 10 zones) ─────────────────────────────

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
    grade_map = {(80,101):"A", (60,80):"B", (40,60):"C", (20,40):"D", (0,20):"F"}
    for zone, count in counts.items():
        base_lat, base_lng = ZONE_COORDS[zone]
        for i in range(1, count + 1):
            health = round(random.uniform(35, 92), 2)
            grade = next(g for (lo,hi),g in grade_map.items() if lo <= health < hi)
            lat = round(base_lat + random.uniform(-0.08, 0.08), 6)
            lng = round(base_lng + random.uniform(-0.08, 0.08), 6)
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
    ward_id       INTEGER PRIMARY KEY,
    ward_name     TEXT    NOT NULL,
    zone          TEXT    NOT NULL,
    health_score  DECIMAL(5,2) DEFAULT 50,
    health_grade  TEXT    DEFAULT 'C',
    lat_center    DECIMAL(10,6),
    lng_center    DECIMAL(10,6),
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ADMINS
CREATE TABLE admins (
    admin_id      UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id   TEXT    UNIQUE NOT NULL,
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    phone_number  TEXT,
    password_hash TEXT    NOT NULL,
    role          TEXT    DEFAULT 'admin',
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- OFFICERS
CREATE TABLE officers (
    officer_id    UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id   TEXT    UNIQUE NOT NULL,
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    phone_number  TEXT,
    ward_id       INTEGER REFERENCES wards(ward_id),
    designation   TEXT    DEFAULT 'Field Officer',
    is_active     BOOLEAN DEFAULT TRUE,
    password_hash TEXT    NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- CITIZENS
CREATE TABLE citizens (
    citizen_id    UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    phone_number  TEXT    UNIQUE NOT NULL,
    ward_id       INTEGER REFERENCES wards(ward_id),
    address       TEXT,
    password_hash TEXT    NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- COMPLAINTS
CREATE TABLE complaints (
    complaint_id     UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    citizen_id       UUID    REFERENCES citizens(citizen_id),
    ward_id          INTEGER REFERENCES wards(ward_id),
    officer_id       UUID    REFERENCES officers(officer_id),
    category         TEXT,
    subcategory      TEXT,
    title            TEXT    NOT NULL,
    description      TEXT    NOT NULL,
    status           TEXT    DEFAULT 'submitted',
    urgency          TEXT    DEFAULT 'medium',
    latitude         DECIMAL(10,6),
    longitude        DECIMAL(10,6),
    address          TEXT,
    photo_urls       TEXT[]  DEFAULT '{}',
    voice_transcript TEXT,
    ai_summary       TEXT,
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
CREATE TABLE complaint_status_history (
    history_id   UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID    REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    changed_by   UUID,
    changed_by_role TEXT,
    old_status   TEXT,
    new_status   TEXT    NOT NULL,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- COMPLAINT MESSAGES (Officer ↔ Citizen communication)
CREATE TABLE complaint_messages (
    message_id   UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID    REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    sender_id    UUID    NOT NULL,
    sender_role  TEXT    NOT NULL,  -- 'citizen' | 'officer' | 'admin'
    sender_name  TEXT,
    message_text TEXT    NOT NULL,
    is_read      BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE notifications (
    notification_id UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID    NOT NULL,
    user_role       TEXT    NOT NULL,  -- 'citizen' | 'officer' | 'admin'
    complaint_id    UUID    REFERENCES complaints(complaint_id) ON DELETE SET NULL,
    title           TEXT    NOT NULL,
    body            TEXT    NOT NULL,
    type            TEXT    DEFAULT 'status_update',
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- WARD HEALTH SCORES (historical)
CREATE TABLE ward_health_scores (
    score_id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    ward_id          INTEGER REFERENCES wards(ward_id),
    composite_score  DECIMAL(5,2) NOT NULL,
    resolution_rate  DECIMAL(5,2),
    avg_response_hrs DECIMAL(8,2),
    sla_breach_rate  DECIMAL(5,2),
    calculated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- WEEKLY DIGESTS
CREATE TABLE weekly_digests (
    digest_id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    digest_type          TEXT    NOT NULL DEFAULT 'ward',  -- 'ward' | 'zone' | 'city'
    ward_id              INTEGER REFERENCES wards(ward_id),
    zone_name            TEXT,
    week_start           DATE    NOT NULL,
    week_end             DATE    NOT NULL,
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
    key_achievements     TEXT[]  DEFAULT '{}',
    areas_of_concern     TEXT[]  DEFAULT '{}',
    is_published         BOOLEAN DEFAULT FALSE,
    published_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (ward_id, week_start)
);

-- PREDICTIVE ALERTS
CREATE TABLE predictive_alerts (
    alert_id      UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    ward_id       INTEGER REFERENCES wards(ward_id),
    alert_type    TEXT    NOT NULL,
    severity      TEXT    DEFAULT 'medium',
    title         TEXT    NOT NULL,
    description   TEXT,
    evidence      JSONB   DEFAULT '{}',
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at    TIMESTAMPTZ
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
    """Return (week_start, week_end) for N weeks ago. week_end = week_start + 6 days."""
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
        ("MCD-ADMIN-001", "Rajesh Kumar Sharma",   "admin1@mcd.delhi.gov.in", "+919810001001", pw),
        ("MCD-ADMIN-002", "Priya Malhotra",         "admin2@mcd.delhi.gov.in", "+919810001002", pw),
    ]
    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO admins (employee_id, name, email, phone_number, password_hash)
               VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING""",
            admins
        )
    print(f"✅ {len(admins)} admins seeded")

# ─── Seed officers (2 per ward) ───────────────────────────────────────────────

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
            phone  = f"+9198{wid:04d}{i:03d}"[:13]  # keep E.164 safe
            desig  = random.choice(DESIGNATIONS)
            officers.append((emp_id, name, email, phone, wid, desig, pw))

    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO officers (employee_id, name, email, phone_number, ward_id, designation, password_hash)
               VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING""",
            officers
        )
    print(f"✅ {len(officers)} officers seeded")

    # Return map ward_id → [officer_uuid, ...]
    rows = await pool.fetch("SELECT officer_id, ward_id FROM officers ORDER BY ward_id, employee_id")
    officer_map: dict[int, list] = {}
    for r in rows:
        officer_map.setdefault(r["ward_id"], []).append(r["officer_id"])
    return officer_map

# ─── Seed citizens (10 per ward) ─────────────────────────────────────────────

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

# ─── Seed complaints (spread across 12 weeks + current week) ─────────────────

COMPLAINT_TEMPLATES = {
    "pothole":       ("Large Pothole on Main Road", "Deep pothole causing accidents near the junction."),
    "garbage":       ("Uncollected Garbage Pile",   "Garbage not collected for several days, causing stench."),
    "sewage":        ("Sewage Overflow on Street",  "Overflowing sewer blocking pedestrian path."),
    "water_supply":  ("No Water Supply for Days",   "Water supply disrupted for residents of this area."),
    "streetlight":   ("Street Lights Not Working",  "Multiple streetlights broken, area unsafe at night."),
    "tree":          ("Fallen Tree Blocking Road",  "Large tree fell due to storm, blocking main road."),
    "stray_animals": ("Aggressive Stray Dogs",      "Pack of stray dogs attacking pedestrians near park."),
    "encroachment":  ("Illegal Encroachment",       "Shop owner has encroached footpath, blocking access."),
    "noise":         ("Noise Pollution from Site",  "Construction site causing extreme noise past midnight."),
    "other":         ("Civic Issue Reported",       "Miscellaneous civic issue affecting residents."),
}

async def seed_complaints(pool, wards, citizen_map, officer_map):
    """
    Seeds complaints spread over 13 weeks:
      - Weeks 12..1 ago: 5 complaints per ward per week (historical)
      - Week 0 (current running week): 2 complaints per ward
    Each complaint has a realistic status progression.
    """
    complaints_data = []  # list of dicts for later use
    rows_to_insert  = []

    for w in wards:
        wid      = w["ward_id"]
        citizens = citizen_map.get(wid, [])
        officers = officer_map.get(wid, [])
        if not citizens or not officers:
            continue

        # 12 historical weeks + current week
        for weeks_ago in range(0, 13):
            ws, we    = week_bounds(weeks_ago)
            ws_dt     = utc(ws)
            we_dt     = utc(we) + timedelta(days=1)
            n_complaints = 2 if weeks_ago == 0 else 5

            for _ in range(n_complaints):
                citizen_id  = random.choice(citizens)
                officer_id  = random.choice(officers)
                category    = random.choices(CATEGORIES, weights=[15,18,12,12,10,5,8,8,7,5])[0]
                urgency     = random.choices(URGENCY_LEVELS, weights=[10,25,45,20])[0]
                title, desc = COMPLAINT_TEMPLATES[category]
                created_at  = rand_dt(ws_dt, we_dt - timedelta(hours=1))

                # Decide final status based on age
                if weeks_ago == 0:
                    status = random.choices(["submitted", "assigned"], weights=[60, 40])[0]
                elif weeks_ago == 1:
                    status = random.choices(["assigned", "acknowledged", "in_progress", "resolved"],
                                            weights=[15, 20, 30, 35])[0]
                else:
                    status = random.choices(["in_progress", "resolved", "closed"],
                                            weights=[10, 70, 20])[0]

                resolved_at = None
                if status in STATUS_TERMINAL:
                    resolved_at = created_at + timedelta(hours=random.uniform(4, SLA_HOURS[category] * 1.5))

                sla_hours    = SLA_HOURS[category]
                sla_deadline = created_at + timedelta(hours=sla_hours)
                sla_breached = resolved_at > sla_deadline if resolved_at else (
                    datetime.now(timezone.utc) > sla_deadline
                )
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
                    "citizen_id": citizen_id,
                    "officer_id": officer_id,
                    "ward_id":    wid,
                    "category":   category,
                    "urgency":    urgency,
                    "status":     status,
                    "created_at": created_at,
                    "resolved_at": resolved_at,
                    "sla_breached": sla_breached,
                    "weeks_ago":  weeks_ago,
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

async def seed_status_history(pool, complaints):
    """Full pipeline history for each complaint based on its final status."""
    STATUS_ORDER = ["submitted", "assigned", "acknowledged", "in_progress", "resolved"]
    rows = []

    for c in complaints:
        final  = c["status"]
        stages = STATUS_ORDER[:STATUS_ORDER.index(final) + 1] if final in STATUS_ORDER else ["submitted", "closed"]
        t      = c["created_at"]
        prev   = None
        for stage in stages:
            gap = timedelta(hours=random.uniform(0.5, 8))
            t   = t + gap
            if c.get("resolved_at") and stage == "resolved":
                t = c["resolved_at"]
            actor   = c["officer_id"] or c["citizen_id"]
            role    = "officer" if stage not in ("submitted",) else "citizen"
            notes   = {
                "submitted":    "Complaint submitted by citizen",
                "assigned":     "Complaint assigned to ward officer",
                "acknowledged": "Officer acknowledged the complaint",
                "in_progress":  "Repair/resolution work started",
                "resolved":     "Issue resolved and verified",
            }.get(stage, "Status updated")
            rows.append((c["complaint_id"], actor, role, prev, stage, notes, t))
            prev = stage

    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO complaint_status_history
               (complaint_id, changed_by, changed_by_role, old_status, new_status, notes, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING""",
            rows
        )
    print(f"✅ {len(rows)} status history rows seeded")

# ─── Seed complaint messages (officer ↔ citizen) ──────────────────────────────

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
    """Seed 2–4 messages per complaint that has an assigned officer."""
    rows = []
    active = [c for c in complaints if c.get("officer_id") and c["status"] not in ("submitted",)]
    for c in active[:3000]:  # cap for performance
        n_msgs = random.randint(2, 4)
        t      = c["created_at"] + timedelta(hours=2)
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

async def seed_notifications(pool, complaints):
    """
    For each complaint that changed status, create:
      - 1 notification for the citizen (status update)
      - 1 notification for the assigned officer (new assignment)
    """
    rows = []
    for c in complaints[:4000]:  # cap
        cid = c["complaint_id"]
        status = c["status"]

        # Citizen notification
        rows.append((
            c["citizen_id"], "citizen", cid,
            f"Complaint {status.replace('_',' ').title()}",
            f"Your complaint has been updated to: {status.replace('_',' ')}",
            "status_update",
            random.random() > 0.4,  # 60% read
            c["created_at"] + timedelta(hours=1),
        ))

        # Officer notification (if assigned)
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

# ─── Seed ward health scores (12 weeks history) ───────────────────────────────

async def seed_health_scores(pool, wards):
    rows = []
    for w in wards:
        base_score = float(w["health_score"])
        for weeks_ago in range(12, -1, -1):
            ws, _ = week_bounds(weeks_ago)
            score = round(max(20, min(98, base_score + random.uniform(-8, 8))), 2)
            res_rate   = round(random.uniform(50, 95), 2)
            avg_hrs    = round(random.uniform(12, 96), 2)
            breach_rate = round(random.uniform(0, 30), 2)
            rows.append((w["ward_id"], score, res_rate, avg_hrs, breach_rate, utc(ws)))

    async with pool.acquire() as conn:
        await conn.executemany(
            """INSERT INTO ward_health_scores
               (ward_id, composite_score, resolution_rate, avg_response_hrs, sla_breach_rate, calculated_at)
               VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING""",
            rows
        )
    print(f"✅ {len(rows)} ward health score rows seeded")

# ─── Seed weekly digests (ward + zone + city, 13 weeks) ──────────────────────

async def seed_weekly_digests(pool, wards, complaints):
    """
    Seeds full weekly_digests for ALL 272 wards × 13 weeks,
    ALL 10 zones × 13 weeks, and city × 13 weeks.
    Uses real complaint data already inserted.
    """
    print("⏳ Seeding weekly digests (ward × zone × city × 13 weeks)…")

    # Index complaints by ward_id and week
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

    # Build zone → ward_ids map
    zone_wards: dict[str, list] = defaultdict(list)
    for w in wards:
        zone_wards[w["zone"]].append(w["ward_id"])
    ward_zone = {w["ward_id"]: w["zone"] for w in wards}

    digest_rows = []

    for weeks_ago in range(13):
        ws, we = week_bounds(weeks_ago)
        ws_dt  = utc(ws)
        we_dt  = utc(we) + timedelta(days=1)

        # ── Ward digests ──────────────────────────────────────────────────────
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
            top_cat     = max(CATEGORIES, key=lambda cat: sum(1 for c in comps if c["category"] == cat)) if comps else "other"
            cat_json    = category_breakdown_json(comps) if comps else "[]"
            urg_json    = urgency_breakdown_json(comps)  if comps else "[]"
            summary     = (f"{w['ward_name']}: {total} complaints, "
                           f"{resolved} resolved ({res_rate:.0f}%) in week of {ws.strftime('%b %d')}.")
            achievements, concerns = build_achievements_concerns(
                res_rate, avg_hrs, score_start, score_end, breaches, total)
            published_at = utc(we) + timedelta(days=1, hours=23)

            digest_rows.append((
                "ward", wid, None,  # digest_type, ward_id, zone_name
                ws, we,
                total, resolved, pending, res_rate, avg_hrs, top_cat,
                cat_json, urg_json,
                score_start, score_end, round(score_end - score_start, 2),
                summary, summary,  # summary_en, summary_hi (same for mock)
                achievements, concerns,
                True, published_at,
            ))

        # ── Zone digests ──────────────────────────────────────────────────────
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
            top_cat  = max(CATEGORIES, key=lambda cat: sum(1 for c in zone_comps if c["category"] == cat)) if zone_comps else "other"
            cat_json = category_breakdown_json(zone_comps) if zone_comps else "[]"
            urg_json = urgency_breakdown_json(zone_comps)  if zone_comps else "[]"
            summary  = (f"{zone} Zone: {total} complaints city-wide, "
                        f"{resolved} resolved ({res_rate:.0f}%) for week of {ws.strftime('%b %d')}.")
            achievements, concerns = build_achievements_concerns(
                res_rate, avg_hrs, score_start, score_end, breaches, total)

            digest_rows.append((
                "zone", None, zone,  # ward_id=None for zone rows
                ws, we,
                total, resolved, pending, res_rate, avg_hrs, top_cat,
                cat_json, urg_json,
                score_start, score_end, round(score_end - score_start, 2),
                summary, summary,
                achievements, concerns,
                True, utc(we) + timedelta(days=1, hours=23),
            ))

        # ── City digest ───────────────────────────────────────────────────────
        all_comps = [c for key_comps in ward_week_complaints.values()
                     for c in key_comps if key_comps and utc(ws) <= c["created_at"] < we_dt]
        # simpler: pull all for this week
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
        top_cat  = max(CATEGORIES, key=lambda cat: sum(1 for c in all_comps if c["category"] == cat)) if all_comps else "other"
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

    # Batch insert — ward rows use UNIQUE(ward_id, week_start), zone/city use ON CONFLICT DO NOTHING
    ward_rows = [r for r in digest_rows if r[0] == "ward"]
    other_rows = [r for r in digest_rows if r[0] != "ward"]

    async with pool.acquire() as conn:
        # Ward digests — use ON CONFLICT UPDATE so re-runs are safe
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

        # Zone + city digests
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

    ward_count  = len(ward_rows)
    zone_count  = sum(1 for r in other_rows if r[0] == "zone")
    city_count  = sum(1 for r in other_rows if r[0] == "city")
    print(f"✅ Weekly digests: {ward_count} ward rows, {zone_count} zone rows, {city_count} city rows")

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

    print("Step 9/9 — Seed weekly digests (ward + zone + city × 13 weeks)…")
    await seed_weekly_digests(pool, wards, complaints)

    await pool.close()

    print(f"\n{'='*60}")
    print("✅ DATABASE FULLY SEEDED")
    print(f"{'='*60}")
    print("""
CREDENTIALS:
  Admin:   MCD-ADMIN-001 / Admin@123!
           MCD-ADMIN-002 / Admin@456!   ← (same pw Admin@123!)
  Officer: officer{ward_id}_1@mcd.delhi.gov.in / Officer@123!
  Citizen: citizen{ward_id}_1@test.com  / TestPass@123

DATA:
  272 wards  ×  10 zones
  2 admins  |  544 officers  |  2720 citizens
  ~18,000 complaints across 13 weeks
  complaint_messages: officer↔citizen per complaint
  notifications: citizen + officer inboxes populated
  weekly_digests: ward × zone × city × 13 weeks
    (category_breakdown + urgency_breakdown + summaries included)
""")

if __name__ == "__main__":
    asyncio.run(main())