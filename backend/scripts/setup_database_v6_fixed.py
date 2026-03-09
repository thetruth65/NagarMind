"""
NagarMind — Database Setup Script v6 FIXED
Clears ALL tables then re-seeds fresh data with:
  - 272 official MCD Delhi wards
  - 10 citizens per ward (2720 total)
  - 2 officers per ward (544 total)
  - 500-600 complaints with proper SLA tracking
  - Weekly digests with health scores
  - Proper authentication support

Run: python scripts/setup_database_v6_fixed.py
"""
import asyncio
import asyncpg
import os
import random
import hashlib
import bcrypt
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from dotenv import load_dotenv

load_dotenv()

# ─── SCHEMA WITH ALL FIXES ─────────────────────────────────────────────────────
SCHEMA = """
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS wards (
    ward_id             SERIAL PRIMARY KEY,
    ward_name           VARCHAR(120) NOT NULL,
    zone                VARCHAR(60)  NOT NULL,
    lat_center          DECIMAL(9,6),
    lng_center          DECIMAL(9,6),
    geojson_polygon     JSONB,
    health_score        DECIMAL(5,2)  DEFAULT 50.0,
    health_grade        CHAR(1)       DEFAULT 'C',
    health_updated_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_sessions (
    phone_number        VARCHAR(15)  PRIMARY KEY,
    otp_hash            VARCHAR(128) NOT NULL,
    role                VARCHAR(20)  NOT NULL DEFAULT 'citizen',
    expires_at          TIMESTAMPTZ  NOT NULL,
    attempt_count       SMALLINT     NOT NULL DEFAULT 0,
    used                BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
    admin_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id         VARCHAR(30)  UNIQUE NOT NULL,
    full_name           VARCHAR(120) NOT NULL,
    password_hash       VARCHAR(128) NOT NULL,
    designation         VARCHAR(80)  DEFAULT 'Commissioner',
    email               VARCHAR(120),
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS citizens (
    citizen_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number        VARCHAR(15)  UNIQUE NOT NULL,
    full_name           VARCHAR(120) NOT NULL,
    ward_id             INT REFERENCES wards(ward_id),
    home_address        TEXT,
    preferred_language  VARCHAR(10)  NOT NULL DEFAULT 'en',
    password_hash       VARCHAR(255) NOT NULL,
    profile_photo_url   TEXT,
    total_complaints    INT          NOT NULL DEFAULT 0,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS officers (
    officer_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id             VARCHAR(30)  UNIQUE NOT NULL,
    phone_number            VARCHAR(15)  UNIQUE,
    full_name               VARCHAR(120) NOT NULL,
    password_hash           VARCHAR(128) NOT NULL,
    designation             VARCHAR(80),
    department              VARCHAR(80),
    ward_id                 INT REFERENCES wards(ward_id),
    zone                    VARCHAR(60),
    preferred_language      VARCHAR(10)  NOT NULL DEFAULT 'en',
    is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
    is_admin                BOOLEAN      NOT NULL DEFAULT FALSE,
    total_assigned          INT          NOT NULL DEFAULT 0,
    total_resolved          INT          NOT NULL DEFAULT 0,
    avg_resolution_hours    DECIMAL(8,2),
    sla_compliance_rate     DECIMAL(5,2),
    citizen_rating_avg      DECIMAL(4,3),
    performance_score       DECIMAL(5,2),
    current_lat             DECIMAL(9,6),
    current_lng             DECIMAL(9,6),
    location_updated_at     TIMESTAMPTZ,
    last_login              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complaints (
    complaint_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id              UUID NOT NULL REFERENCES citizens(citizen_id),
    ward_id                 INT  NOT NULL REFERENCES wards(ward_id),
    assigned_officer_id     UUID REFERENCES officers(officer_id),
    title                   VARCHAR(200) NOT NULL,
    description             TEXT NOT NULL,
    description_translated  TEXT,
    original_language       VARCHAR(10)  NOT NULL DEFAULT 'en',
    category                VARCHAR(50),
    sub_category            VARCHAR(80),
    department              VARCHAR(80),
    urgency                 VARCHAR(20)  DEFAULT 'medium',
    status                  VARCHAR(30)  NOT NULL DEFAULT 'submitted',
    ai_summary              TEXT,
    ai_category_confidence  DECIMAL(5,4),
    photo_urls              TEXT[],
    audio_url               TEXT,
    location_lat            DECIMAL(9,6),
    location_lng            DECIMAL(9,6),
    location_address        TEXT,
    location_hash           VARCHAR(32),
    sla_hours               INT,
    sla_deadline            TIMESTAMPTZ,
    sla_breached            BOOLEAN NOT NULL DEFAULT FALSE,
    sla_breach_notified     BOOLEAN NOT NULL DEFAULT FALSE,
    is_duplicate            BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_at            TIMESTAMPTZ,
    assigned_at             TIMESTAMPTZ,
    acknowledged_at         TIMESTAMPTZ,
    resolved_at             TIMESTAMPTZ,
    resolution_note         TEXT,
    citizen_rating          SMALLINT,
    citizen_feedback        TEXT,
    disputed                BOOLEAN NOT NULL DEFAULT FALSE,
    dispute_reason          TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complaint_status_history (
    history_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id    UUID NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    old_status      VARCHAR(30),
    new_status      VARCHAR(30) NOT NULL,
    changed_by_id   UUID,
    changed_by_role VARCHAR(20),
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    user_role       VARCHAR(20) NOT NULL,
    complaint_id    UUID REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(200),
    message         TEXT,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS predictive_alerts (
    alert_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id         INT REFERENCES wards(ward_id),
    alert_type      VARCHAR(50) NOT NULL,
    severity        VARCHAR(20) NOT NULL DEFAULT 'medium',
    title           VARCHAR(200),
    description     TEXT,
    narrative       TEXT,
    is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weekly_digests (
    digest_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    digest_type         VARCHAR(20) NOT NULL DEFAULT 'ward', -- 'ward', 'zone', 'city'
    ward_id             INT REFERENCES wards(ward_id),
    zone_name           VARCHAR(60),
    week_start          DATE NOT NULL,
    week_end            DATE NOT NULL,
    total_complaints    INT  NOT NULL DEFAULT 0,
    resolved_complaints INT  NOT NULL DEFAULT 0,
    pending_complaints  INT  NOT NULL DEFAULT 0,
    avg_resolution_hours DECIMAL(8,2),
    resolution_rate     DECIMAL(5,2),
    top_category        VARCHAR(50),
    category_breakdown  JSONB,
    urgency_breakdown   JSONB,
    health_score_start  DECIMAL(5,2),
    health_score_end    DECIMAL(5,2),
    score_change        DECIMAL(5,2) DEFAULT 0,
    summary_en          TEXT,
    summary_hi          TEXT,
    key_achievements    TEXT[] DEFAULT '{}',
    areas_of_concern    TEXT[] DEFAULT '{}',
    is_published        BOOLEAN NOT NULL DEFAULT TRUE,
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (digest_type, ward_id, zone_name, week_start)
);

CREATE TABLE IF NOT EXISTS ward_health_scores (
    ward_id             INT REFERENCES wards(ward_id) ON DELETE CASCADE,
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    score_date          DATE,
    resolution_rate     DECIMAL(5,2),
    overdue_count       INT,
    composite_score     DECIMAL(5,2) NOT NULL,
    grade               CHAR(1) NOT NULL,
    trend               VARCHAR(20),
    score_delta_7d      DECIMAL(5,2),
    total_complaints    INT,
    resolved_complaints INT,
    overdue_complaints  INT,
    avg_rating          DECIMAL(4,3),
    PRIMARY KEY (ward_id, calculated_at)
);

CREATE TABLE IF NOT EXISTS ai_classification_logs (
    log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id    UUID REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    raw_response    JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_ward        ON complaints(ward_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_officer     ON complaints(assigned_officer_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_status      ON complaints(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_created     ON complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_citizen     ON complaints(citizen_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_category    ON complaints(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifs_user            ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifs_created         ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_ward            ON predictive_alerts(ward_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_digests_ward           ON weekly_digests(ward_id, week_start DESC);
"""

# ─── DATA CONSTANTS ────────────────────────────────────────────────────────────
WARD_DATA = [
    ("Adarsh Nagar","North"),("Aditi","North-West"),("Ambedkar Nagar","South"),
    ("Anand Parbat","Central"),("Anand Vihar","East"),("Ashok Nagar","East"),
    ("Adarsh Nagar","North"),("Azad Market","Central"),("Badli","North"),
    ("Bawana","North"),("Begumpur","North-West"),("Bijwasan","South-West"),
    ("Bindapur","West"),("Brijpuri","North-East"),("Brahmpuri","North-East"),
    ("Burari","North"),("Chanakyapuri","New Delhi"),("Chandni Chowk","Central"),
    ("Chattarpur","South"),("Civil Lines","North"),("Dakshini Pitampura","North"),
    ("Dashrath Puri","West"),("Dayalpur","North-East"),("Defence Colony","South"),
    ("Delhi Cantt","South-West"),("Delhi Gate","Central"),("Deoli","South"),
    ("Devli","South"),("Dwarka","South-West"),("Dwarka Sector 1","South-West"),
    ("Dwarka Sector 10","South-West"),("Dwarka Sector 11","South-West"),
    ("Dwarka Sector 12","South-West"),("Dwarka Sector 13","South-West"),
    ("Dwarka Sector 14","South-West"),("Dwarka Sector 16","South-West"),
    ("Dwarka Sector 17","South-West"),("Dwarka Sector 18","South-West"),
    ("Dwarka Sector 19","South-West"),("Dwarka Sector 2","South-West"),
    ("Dwarka Sector 22","South-West"),("Fateh Nagar","West"),
    ("Gagan Vihar","East"),("Gandhinagar","East"),("Geeta Colony","East"),
    ("Gokalpur","North-East"),("Greater Kailash","South"),("Green Park","South"),
    ("Hari Nagar","West"),("Harinagar","West"),("Harsh Vihar","North-East"),
    ("Hauz Khas","South"),("Hauz Qazi","Central"),("Inderlok","North"),
    ("Inderpuri","West"),("Jaffrabad","North-East"),("Jangpura","South"),
    ("Janpath","New Delhi"),("Jasola","South"),("Johripur","North-East"),
    ("Kalkaji","South"),("Kalyan Vihar","North"),("Karawal Nagar","North-East"),
    ("Kardam Puri","North-East"),("Karol Bagh","Central"),("Keshav Puram","North"),
    ("Khichripur","East"),("Khyala","West"),("Kirari","North-West"),
    ("Kondli","East"),("Krishna Nagar","East"),("Lal Kuan","Central"),
    ("Laxmi Nagar","East"),("Madipur","West"),("Madanpur Khadar","South"),
    ("Malviya Nagar","South"),("Mandawali","East"),("Mangolpuri","North-West"),
    ("Maujpur","North-East"),("Mehrauli","South"),("Model Town","North"),
    ("Moti Nagar","West"),("Mukherjee Nagar","North"),("Mundka","West"),
    ("Mustafabad","North-East"),("Nabi Karim","Central"),("Najafgarh","South-West"),
    ("Nangloi","West"),("Naraina","West"),("Narela","North"),
    ("Nathupur","North"),("Nehru Vihar","North"),("New Delhi","New Delhi"),
    ("Nihal Vihar","West"),("Nilothi","West"),("Okhla","South"),
    ("Palam","South-West"),("Patel Nagar","Central"),("Patparganj","East"),
    ("Pitampura","North-West"),("Prashant Vihar","North"),("Pulbangash","Central"),
    ("Punjabi Bagh","West"),("Pusa","Central"),("Qutab Nagar","North"),
    ("Rajouri Garden","West"),("Rithala","North-West"),("Rohini","North-West"),
    ("Rohini Sector 15","North-West"),("Rohini Sector 16","North-West"),
    ("Rohini Sector 17","North-West"),("Rohini Sector 18","North-West"),
    ("Rohini Sector 19","North-West"),("Rohini Sector 21","North-West"),
    ("Rohini Sector 24","North-West"),("Rohini Sector 25","North-West"),
    ("Rohini Sector 26","North-West"),("Rohini Sector 27","North-West"),
    ("Sadar Bazar","Central"),("Saket","South"),("Sangam Vihar","South"),
    ("Sant Nagar","North"),("Saraswati Vihar","North-West"),("Seelampur","North-East"),
    ("Seemapuri","North-East"),("Shahdara","North-East"),("Shakti Nagar","North"),
    ("Shakurpur","North-West"),("Shalimar Bagh","North-West"),("Shastri Nagar","North"),
    ("Sriniwaspuri","South"),("Sultanpuri","North-West"),("Tilak Nagar","West"),
    ("Timarpur","North"),("Tri Nagar","North-West"),("Tughlakabad","South"),
    ("Uttam Nagar","West"),("Vasant Kunj","South"),("Vasant Vihar","South"),
    ("Vijay Nagar","North"),("Vikaspuri","West"),("Vishwas Nagar","East"),
    ("Vivek Vihar","East"),("Wazirpur","North"),("Yamuna Vihar","North-East"),
]

ZONES = ["North","North-West","North-East","Shahdara","East",
         "New Delhi","Central","West","South-West","South"]

DEPARTMENTS = ["Roads & Infrastructure","Sanitation","Drainage",
               "Electrical / Street Lighting","Horticulture / Parks",
               "Water Supply","Building & Property","Health","Community Welfare"]

DESIGNATIONS = ["Junior Engineer (JE)","Assistant Engineer (AE)",
                "Executive Engineer (EE)","Sanitation Inspector",
                "Health Inspector","Sub-Divisional Officer (SDO)","Ward Officer"]

CATEGORIES = ["roads_and_footpaths","sanitation_and_garbage","drainage_and_flooding",
               "street_lighting","parks_and_gardens","water_supply",
               "illegal_construction","noise_and_pollution","stray_animals"]

COMPLAINT_TITLES = {
    "roads_and_footpaths": [
        "Large pothole on main road causing accidents",
        "Damaged footpath needs urgent repair",
        "Road cave-in after rainfall",
        "Speed breaker broken and dangerous",
        "Road markings faded completely",
    ],
    "sanitation_and_garbage": [
        "Garbage not collected for 3 days",
        "Overflowing dustbin near market",
        "Open garbage dump attracting animals",
        "Littering on residential street",
        "Garbage burning causing air pollution",
    ],
    "drainage_and_flooding": [
        "Drain blocked causing waterlogging",
        "Sewage overflow on residential road",
        "Storm drain choked with debris",
        "Manhole cover missing — safety hazard",
        "Basement flooding after rain",
    ],
    "street_lighting": [
        "Street light not working for 2 weeks",
        "Multiple lights out in colony",
        "Broken electric pole on road",
        "Flickering street light causing accidents",
        "New area has no street lighting",
    ],
    "parks_and_gardens": [
        "Park benches broken and damaged",
        "Grass not maintained for months",
        "Park lights not working",
        "Children's play equipment broken",
        "Encroachment in public park",
    ],
    "water_supply": [
        "No water supply for 2 days",
        "Contaminated water from tap",
        "Low water pressure in building",
        "Water pipe leaking on street",
        "Water tanker not arriving on schedule",
    ],
    "illegal_construction": [
        "Illegal construction blocking road",
        "Building without permission near park",
        "Encroachment on public footpath",
        "Commercial construction in residential area",
        "Unauthorized extension causing damage",
    ],
    "noise_and_pollution": [
        "Factory noise disturbing residents at night",
        "Open burning of waste near homes",
        "Construction noise after 10 PM",
        "DJ system during prohibited hours",
        "Air pollution from nearby facility",
    ],
    "stray_animals": [
        "Pack of stray dogs attacking pedestrians",
        "Stray cattle blocking traffic",
        "Monkeys damaging property",
        "Stray dogs near school — safety issue",
        "Injured stray animal needs rescue",
    ],
}

URGENCY_WEIGHTS = ["low"] * 10 + ["medium"] * 50 + ["high"] * 30 + ["critical"] * 10
SLA_HOURS = {"critical": 24, "high": 48, "medium": 72, "low": 120}

STATUS_PROGRESSION = [
    ("submitted",    8),
    ("assigned",    15),
    ("acknowledged",15),
    ("in_progress", 20),
    ("resolved",    30),
    ("closed",      12),
]

CITIZEN_PREFIXES = ["Rajesh","Priya","Amit","Sunita","Vikram","Anita","Sanjay",
    "Kavita","Deepak","Meera","Rohit","Pooja","Arun","Sneha","Manoj","Rekha",
    "Vivek","Geeta","Suresh","Neha","Ajay","Ritu","Naveen","Sheela","Tarun",
    "Preeti","Hemant","Vandana","Rakesh","Uma","Ganesh","Lalita","Sameer",
    "Farida","Ashok","Smita","Pankaj","Anjali","Kiran","Harish"]

CITIZEN_SUFFIXES = ["Kumar","Sharma","Singh","Verma","Gupta","Patel","Mehta",
    "Nair","Joshi","Agarwal","Khanna","Malhotra","Mishra","Chaudhary","Yadav",
    "Sinha","Pandey","Saxena","Tiwari","Kapoor","Bhatia","Goel","Dubey","Arora",
    "Bajaj","Chauhan","Shukla","Srivastava","Prasad","Rao","Devi","Khan","Begum",
    "Jain","Dixit","Tripathi","Banerjee","Bedi","Rawat"]

OFFICER_PREFIXES = ["Ram","Vinod","Sushil","Anil","Rajendra","Mukesh","Harish",
    "Sunil","Prem","Ramesh","Girish","Satish","Kamlesh","Bharat","Naresh",
    "Surendra","Dinesh","Mahesh","Umesh","Lokesh","Devendra","Rakesh","Kishore",
    "Pramod","Suresh","Alok","Anand","Vinay","Sanjay","Hemant","Rajan","Vijay"]

OFFICER_SUFFIXES = ["Prakash","Kumar","Sharma","Gupta","Singh","Yadav","Chandra",
    "Mishra","Chand","Verma","Pandey","Patel","Bhushan","Joshi","Nath","Aggarwal",
    "Pandya","Lal","Misra","Babu","Srivastava","Pal","Shankar","Datta","Saxena"]


def hash_pwd(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt(rounds=10)).decode()


def delhi_coords(zone: str) -> tuple:
    zone_bounds = {
        "North":      (28.70, 28.85, 77.10, 77.25),
        "North-West": (28.68, 28.80, 77.05, 77.18),
        "North-East": (28.67, 28.80, 77.25, 77.35),
        "Shahdara":   (28.65, 28.75, 77.28, 77.35),
        "East":       (28.60, 28.72, 77.28, 77.35),
        "New Delhi":  (28.58, 28.65, 77.18, 77.25),
        "Central":    (28.63, 28.70, 77.20, 77.28),
        "West":       (28.62, 28.73, 77.05, 77.18),
        "South-West": (28.54, 28.64, 76.98, 77.10),
        "South":      (28.50, 28.62, 77.18, 77.28),
    }
    bounds = zone_bounds.get(zone, (28.55, 28.78, 77.05, 77.30))
    lat = round(random.uniform(bounds[0], bounds[1]), 6)
    lng = round(random.uniform(bounds[2], bounds[3]), 6)
    return lat, lng


def get_location_hash(lat: float, lng: float) -> str:
    """Generate location hash for duplicate detection"""
    rounded = f"{lat:.4f},{lng:.4f}"
    return hashlib.md5(rounded.encode()).hexdigest()[:8]


def get_272_wards():
    wards = list(WARD_DATA)
    extra_zones = list(ZONES)
    while len(wards) < 272:
        i = len(wards)
        zone = extra_zones[i % len(extra_zones)]
        suffixes = ["Block A","Block B","Block C","Extension","Phase 1","Phase 2",
                    "Phase 3","Enclave","Colony","Nagar","Vihar","Garden","Park"]
        base_names = ["Sundar","Shanti","Pragati","Lok","Jan","Nav","Suraj","Chandra"]
        name = f"{random.choice(base_names)} {random.choice(suffixes)} ({zone[:3]})"
        wards.append((name, zone))
    return wards[:272]


def random_date_in_last_30_days() -> datetime:
    days_ago = random.uniform(0, 30)
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    dt = dt.replace(
        hour=random.randint(6, 22),
        minute=random.randint(0, 59),
        second=random.randint(0, 59),
    )
    return dt


async def drop_all_tables(conn):
    tables = [
        "ai_classification_logs", "ward_health_scores", "weekly_digests",
        "predictive_alerts", "notifications", "complaint_status_history",
        "complaints", "otp_sessions", "officers", "citizens", "admins", "wards",
    ]
    for t in tables:
        await conn.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
    print("  ✓ All tables dropped")


async def setup(pool):
    NOW = datetime.now(timezone.utc)

    # ── 0. DROP + RECREATE ───────────────────────────────────────────────────
    print("\n🗑️  Clearing all tables...")
    async with pool.acquire() as conn:
        await drop_all_tables(conn)

    print("\n📐 Creating schema...")
    async with pool.acquire() as conn:
        for stmt in [s.strip() for s in SCHEMA.split(';') if s.strip()]:
            try:
                await conn.execute(stmt)
            except Exception as e:
                if 'already exists' not in str(e).lower():
                    print(f"  ⚠  {stmt[:80]}… → {e}")
    print("  ✓ Schema ready")

    # ── 1. WARDS ─────────────────────────────────────────────────────────────
    print("\n🗺️  Seeding 272 MCD Delhi wards...")
    wards_data = get_272_wards()
    ward_ids = []
    async with pool.acquire() as conn:
        for name, zone in wards_data:
            lat, lng = delhi_coords(zone)
            score = round(random.uniform(30, 90), 2)
            grade = 'A' if score >= 80 else 'B' if score >= 65 else 'C' if score >= 50 else 'D' if score >= 35 else 'F'
            wid = await conn.fetchval(
                """INSERT INTO wards (ward_name, zone, lat_center, lng_center, health_score, health_grade)
                   VALUES ($1,$2,$3,$4,$5,$6) RETURNING ward_id""",
                name, zone, lat, lng, score, grade
            )
            ward_ids.append((wid, zone))
    print(f"  ✓ {len(ward_ids)} wards seeded")

    # ── 2. ADMINS ────────────────────────────────────────────────────────────
    print("\n👑 Seeding 2 admin accounts...")
    admins = [
        ("MCD-ADMIN-001", "Mohit Sharma",   "Admin@123!", "Commissioner"),
        ("MCD-ADMIN-002", "Priya Kapoor",   "Admin@456!", "Joint Commissioner"),
    ]
    admin_ids = []
    async with pool.acquire() as conn:
        for emp, name, pwd, desig in admins:
            aid = await conn.fetchval(
                """INSERT INTO admins (employee_id, full_name, password_hash, designation)
                   VALUES ($1,$2,$3,$4) RETURNING admin_id""",
                emp, name, hash_pwd(pwd), desig
            )
            admin_ids.append(aid)
            print(f"  ✓ {emp} / {pwd}")

    # ── 3. OFFICERS (2 per ward = 544 total) ──────────────────────────────────
    print("\n👮 Seeding 2 officers per ward (544 total)...")
    officer_ids = []
    officer_ward_map = {}
    async with pool.acquire() as conn:
        officer_count = 0
        for wid, zone in ward_ids:
            for j in range(2):
                officer_count += 1
                name = f"{random.choice(OFFICER_PREFIXES)} {random.choice(OFFICER_SUFFIXES)}"
                emp_id = f"MCD{2024*10000 + officer_count:08d}"
                desig = DESIGNATIONS[officer_count % len(DESIGNATIONS)]
                dept = DEPARTMENTS[officer_count % len(DEPARTMENTS)]
                sla_rate = round(random.uniform(55, 98), 2)
                rating = round(random.uniform(3.2, 5.0), 3)
                perf_score = round((sla_rate * 0.6 + rating * 8), 2)

                oid = await conn.fetchval(
                    """INSERT INTO officers
                       (employee_id, full_name, password_hash, designation, department,
                        ward_id, zone, sla_compliance_rate, citizen_rating_avg, performance_score,
                        total_assigned, total_resolved)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING officer_id""",
                    emp_id, name, hash_pwd("Officer@123!"), desig, dept,
                    wid, zone, sla_rate, rating, perf_score,
                    random.randint(10, 80), random.randint(5, 60)
                )
                officer_ids.append(oid)
                officer_ward_map[oid] = wid
    print(f"  ✓ {officer_count} officers seeded — all password: Officer@123!")

    # ── 4. CITIZENS (10 per ward = 2720 total) ────────────────────────────────
    print("\n👤 Seeding 10 citizens per ward (2720 total)...")
    citizen_ids = []
    # Hash the test password once for all citizens
    test_password_hash = hash_pwd("TestPass@123")
    async with pool.acquire() as conn:
        citizen_count = 0
        for wid, zone in ward_ids:
            for j in range(10):
                citizen_count += 1
                name = f"{random.choice(CITIZEN_PREFIXES)} {random.choice(CITIZEN_SUFFIXES)}"
                phone = f"9{random.randint(100000000, 999999999)}"
                cid = await conn.fetchval(
                    """INSERT INTO citizens (phone_number, full_name, password_hash, ward_id, preferred_language)
                       VALUES ($1,$2,$3,$4,'en') RETURNING citizen_id""",
                    phone, name, test_password_hash, wid
                )
                citizen_ids.append((cid, wid))
    print(f"  ✓ {citizen_count} citizens seeded — all password: TestPass@123")

    # ── 5. COMPLAINTS (500-600 spread over 30 days) ────────────────────────
    print("\n📋 Seeding 550 complaints with proper SLA tracking...")
    complaint_ids = []
    status_pool = []
    for status, pct in STATUS_PROGRESSION:
        status_pool.extend([status] * pct)

    async with pool.acquire() as conn:
        for i in range(550):
            cid, c_ward_id = random.choice(citizen_ids)
            category = random.choice(CATEGORIES)
            title = random.choice(COMPLAINT_TITLES[category])
            urgency = random.choice(URGENCY_WEIGHTS)
            status = random.choice(status_pool)
            created_at = random_date_in_last_30_days()
            sla_hours = SLA_HOURS[urgency]
            sla_deadline = created_at + timedelta(hours=sla_hours)

            resolved_at = None
            if status in ('resolved', 'closed'):
                hours = random.uniform(2, sla_hours * 1.5)
                resolved_at = created_at + timedelta(hours=hours)

            sla_breached = (status not in ('resolved', 'closed') and
                            datetime.now(timezone.utc) > sla_deadline)

            ward_officers = [oid for oid, wid in officer_ward_map.items() if wid == c_ward_id]
            assigned_officer_id = random.choice(ward_officers) if ward_officers and status != 'submitted' else None

            lat, lng = delhi_coords(next((z for wid, z in ward_ids if wid == c_ward_id), "Central"))
            location_hash = get_location_hash(lat, lng)

            rating = random.randint(1, 5) if status in ('resolved', 'closed') and random.random() > 0.3 else None

            comp_id = await conn.fetchval(
                """INSERT INTO complaints
                   (citizen_id, ward_id, assigned_officer_id, title, description,
                    category, urgency, status, sla_hours, sla_deadline, sla_breached,
                    sla_breach_notified, is_duplicate, location_lat, location_lng, location_hash,
                    resolved_at, citizen_rating, created_at, updated_at, submitted_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19,$20)
                   RETURNING complaint_id""",
                cid, c_ward_id, assigned_officer_id,
                title,
                f"Complaint regarding {title.lower()} in our locality. Needs urgent attention from MCD officials.",
                category, urgency, status,
                sla_hours, sla_deadline, sla_breached,
                False, False,  # sla_breach_notified, is_duplicate
                lat, lng, location_hash,
                resolved_at, rating, created_at, created_at
            )
            complaint_ids.append(comp_id)

            # ✅ FIX: Update citizen total_complaints count
            await conn.execute(
                "UPDATE citizens SET total_complaints = total_complaints + 1 WHERE citizen_id = $1",
                cid
            )

            if status != 'submitted':
                await conn.execute(
                    """INSERT INTO complaint_status_history
                       (complaint_id, old_status, new_status, changed_by_role, created_at)
                       VALUES ($1,'submitted',$2,'officer',$3)""",
                    comp_id, status, created_at + timedelta(hours=random.uniform(1, 12))
                )

    total = await pool.fetchval("SELECT COUNT(*) FROM complaints")
    print(f"  ✓ {total} complaints seeded")

    # ── 6. WARD HEALTH RECALCULATION ─────────────────────────────────────────
    print("\n🏥 Recalculating ward health scores from complaint data...")
    async with pool.acquire() as conn:
        ward_rows = await conn.fetch("SELECT ward_id FROM wards")
        for row in ward_rows:
            wid = row['ward_id']
            stats = await conn.fetchrow(
                """SELECT
                     COUNT(*) AS total,
                     COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved,
                     COUNT(*) FILTER (WHERE sla_breached AND status NOT IN ('resolved','closed')) AS breached,
                     COUNT(*) FILTER (WHERE is_duplicate = TRUE) AS duplicates,
                     AVG(citizen_rating) FILTER (WHERE citizen_rating IS NOT NULL) AS avg_rating
                   FROM complaints WHERE ward_id=$1""", wid
            )
            total_c = stats['total'] or 0
            resolved_c = stats['resolved'] or 0
            breached_c = stats['breached'] or 0
            dupl_c = stats['duplicates'] or 0
            avg_r = float(stats['avg_rating'] or 3.5)

            if total_c == 0:
                score = round(random.uniform(40, 70), 2)
            else:
                res_rate = resolved_c / total_c
                breach_penalty = min(breached_c * 3, 30)
                dupl_penalty = min(dupl_c * 2, 10)
                score = round(max(10, min(100, res_rate * 70 + avg_r * 6 - breach_penalty - dupl_penalty)), 2)

            grade = 'A' if score >= 80 else 'B' if score >= 65 else 'C' if score >= 50 else 'D' if score >= 35 else 'F'
            await conn.execute(
                "UPDATE wards SET health_score=$1, health_grade=$2, health_updated_at=NOW() WHERE ward_id=$3",
                score, grade, wid
            )
    print("  ✓ Ward health scores updated")

    # ── 7. WEEKLY DIGESTS (last 4 weeks) ──────────────────────────────────────
    print("\n📊 Generating weekly digests (last 4 weeks)...")
    today = datetime.now(timezone.utc).date()
    last_monday = today - timedelta(days=today.weekday())

    digest_count = 0
    async with pool.acquire() as conn:
        top_wards = await conn.fetch("SELECT ward_id, ward_name, health_score FROM wards LIMIT 30")

        for week_offset in range(4):
            week_start_date = last_monday - timedelta(weeks=week_offset + 1)
            week_end_date = week_start_date + timedelta(days=6)

            # ✅ FIX: Convert to timezone-aware datetime for PostgreSQL
            week_start_dt = datetime.combine(week_start_date, datetime.min.time(), tzinfo=timezone.utc)
            week_end_dt = datetime.combine(week_end_date, datetime.min.time(), tzinfo=timezone.utc)
            # ✅ FIX: Add one day to week_end_dt in Python to avoid PostgreSQL operator issue
            week_end_dt_plus_one = week_end_dt + timedelta(days=1)

            for ward_row in top_wards:
                wid = ward_row['ward_id']
                wname = ward_row['ward_name']
                health_start = float(ward_row['health_score'])


                stats = await conn.fetchrow(
                    """SELECT
                         COUNT(*) AS total,
                         COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved,
                         AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)
                           FILTER (WHERE resolved_at IS NOT NULL) AS avg_hours,
                         mode() WITHIN GROUP (ORDER BY category) AS top_cat
                       FROM complaints
                       WHERE ward_id=$1
                         AND created_at >= $2
                         AND created_at < $3""",
                    wid,
                    week_start_dt,
                    week_end_dt_plus_one,
                )

                total_c = stats['total'] or random.randint(2, 15)
                resolved_c = stats['resolved'] or random.randint(1, total_c)
                avg_h = float(stats['avg_hours'] or random.uniform(12, 96))
                top_cat = stats['top_cat'] or random.choice(CATEGORIES)
                res_rate = round((resolved_c / total_c) * 100, 2) if total_c > 0 else 0
                score_change = round(random.uniform(-8, 12), 2)
                health_end = round(float(health_start) + score_change, 2)

                summary = (
                    f"This week, {wname} ward reported {total_c} civic complaints. "
                    f"{resolved_c} were resolved ({res_rate:.0f}% resolution rate). "
                    f"Average resolution time was {avg_h:.0f} hours. "
                    f"Most common issue: {top_cat.replace('_', ' ').title()}."
                )

                try:
                    await conn.execute(
                        """INSERT INTO weekly_digests
                           (ward_id, week_start, week_end, total_complaints,
                            resolved_complaints, pending_complaints, avg_resolution_hours,
                            resolution_rate, top_category, health_score_start, health_score_end,
                            score_change, summary_en, is_published)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE)
                           ON CONFLICT (ward_id, week_start) DO NOTHING""",
                        wid, week_start_dt, week_end_dt, total_c,
                        resolved_c, total_c - resolved_c,
                        round(avg_h, 2), res_rate, top_cat, health_start, health_end, score_change, summary,
                    )
                    digest_count += 1
                except Exception:
                    pass

    print(f"  ✓ {digest_count} weekly digest records created")

    # ── 8. DEMO ALERTS ───────────────────────────────────────────────────────
    print("\n🔔 Seeding demo alerts...")
    alert_data = [
        (ward_ids[0][0], "critical", "Severe waterlogging reported",
         "Multiple complaints about flooding in the ward after recent rainfall."),
        (ward_ids[1][0], "high", "Garbage collection disrupted",
         "Waste pickup missed for 4 consecutive days in this area."),
        (ward_ids[2][0], "medium", "Street lighting failure",
         "Over 20 street lights reported non-functional this week."),
        (ward_ids[3][0], "low", "Park maintenance overdue",
         "Residents report grass uncut and benches damaged."),
    ]
    async with pool.acquire() as conn:
        for wid, sev, title, desc in alert_data:
            await conn.execute(
                """INSERT INTO predictive_alerts
                   (ward_id, alert_type, severity, title, description, is_resolved)
                   VALUES ($1,'admin_alert',$2,$3,$4,FALSE)""",
                wid, sev, title, desc
            )
    print("  ✓ 4 demo alerts created")

    # ── SUMMARY ───────────────────────────────────────────────────────────────
    total_comp = await pool.fetchval("SELECT COUNT(*) FROM complaints")
    print(f"""
{'='*60}
🚀 NagarMind Database Ready - FIXED VERSION!
{'='*60}
  Wards:       {await pool.fetchval("SELECT COUNT(*) FROM wards")}
  Admins:      2
               MCD-ADMIN-001 / Admin@123!
               MCD-ADMIN-002 / Admin@456!
  Officers:    {await pool.fetchval("SELECT COUNT(*) FROM officers")} (2 per ward, all: Officer@123!)
  Citizens:    {await pool.fetchval("SELECT COUNT(*) FROM citizens")} (10 per ward)
  Complaints:  {total_comp} (spread over last 30 days)
  
  Digests:     {await pool.fetchval("SELECT COUNT(*) FROM weekly_digests")} weekly digest records
  Alerts:      {await pool.fetchval("SELECT COUNT(*) FROM predictive_alerts")}

Key Fixes Applied:
  ✅ Added sla_hours column to complaints
  ✅ Added sla_breach_notified to complaints
  ✅ Added is_duplicate to complaints
  ✅ Added location_hash for duplicate detection
  ✅ Added health_score_start & health_score_end to weekly_digests
  ✅ Fixed ward_health_scores with calculated_at timestamp
  ✅ All queries now use correct column names

Next steps:
  1. cd backend && python scripts/setup_database_v6_fixed.py
  2. cd backend && uvicorn main:app --reload --port 8000
  3. cd frontend && npm run dev
  4. Admin:   /officer/auth  →  MCD-ADMIN-001 / Admin@123!
  5. Officer: /officer/auth  →  MCD202400001 / Officer@123!
  6. Citizen: /citizen/auth  →  any 10-digit number
{'='*60}
""")


async def main():
    db_url = os.getenv("DATABASE_URL_SYNC") or os.getenv("DATABASE_URL", "")
    if not db_url:
        print("❌ DATABASE_URL or DATABASE_URL_SYNC not set in .env")
        print("   Add: DATABASE_URL_SYNC=postgresql://user:pass@host/dbname")
        return
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    print(f"Connecting to database...")
    pool = await asyncpg.create_pool(db_url, min_size=1, max_size=3, ssl="require")
    try:
        await setup(pool)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
