"""
NagarMind Backend — FastAPI Application Entry Point
MCD Delhi Civic Intelligence Platform
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.database import init_db, close_db, get_db_pool

# ── Routers ──────────────────────────────────────────────────────────────────
from app.api.auth            import router as auth_router
from app.api.complaints      import router as complaints_router
from app.api.citizen_profile import router as citizen_router
from app.api.officer         import router as officer_router
from app.api.admin           import router as admin_router
from app.api.analytics       import router as analytics_router
from app.api.translate       import router as translate_router
from app.api.upload          import router as upload_router
from app.api.wards            import router as ward_router
from app.api.websocket_routes import router as ws_router

# ── Services ──────────────────────────────────────────────────────────────────
from app.services.sla_checker          import check_sla_breaches
from app.services.predictive_alerts    import run_predictive_alerts
from app.services.ward_health_service  import recalculate_all_wards
from app.services.weekly_digest_service import generate_all_ward_digests

import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
log = logging.getLogger("nagarmind")

# ── Scheduler ─────────────────────────────────────────────────────────────────
scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


def _add_jobs():
    """Register all scheduled jobs."""

    # 1. SLA breach checker — every 30 minutes
    scheduler.add_job(
        _run_sla_check,
        trigger=IntervalTrigger(minutes=30),
        id="sla_check",
        replace_existing=True,
        max_instances=1,
    )

    # 2. Predictive alert scanner — every hour at :05
    scheduler.add_job(
        _run_alert_scan,
        trigger=CronTrigger(minute=5),
        id="alert_scan",
        replace_existing=True,
        max_instances=1,
    )

    # 3. Ward health recalculation — every hour at :20
    scheduler.add_job(
        _run_health_recalc,
        trigger=CronTrigger(minute=20),
        id="health_recalc",
        replace_existing=True,
        max_instances=1,
    )

    # 4. Weekly digest generation — every Sunday at 06:00 IST
    scheduler.add_job(
        _run_weekly_digest,
        trigger=CronTrigger(day_of_week="sun", hour=6, minute=0),
        id="weekly_digest",
        replace_existing=True,
        max_instances=1,
    )

    log.info("✅ Scheduled jobs registered: sla_check, alert_scan, health_recalc, weekly_digest")


# ── Scheduled job wrappers (acquire pool inside) ──────────────────────────────

async def _run_sla_check():
    log.info("[CRON] Running SLA breach check ...")
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await check_sla_breaches(conn)
        log.info("[CRON] SLA check complete")
    except Exception as e:
        log.error(f"[CRON] SLA check failed: {e}")


async def _run_alert_scan():
    log.info("[CRON] Running predictive alert scan ...")
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await run_predictive_alerts(conn)
        log.info("[CRON] Alert scan complete")
    except Exception as e:
        log.error(f"[CRON] Alert scan failed: {e}")


async def _run_health_recalc():
    log.info("[CRON] Recalculating ward health scores ...")
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await recalculate_all_wards(conn)
        log.info("[CRON] Ward health recalc complete")
    except Exception as e:
        log.error(f"[CRON] Health recalc failed: {e}")


async def _run_weekly_digest():
    log.info("[CRON] Generating weekly digests ...")
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await generate_all_ward_digests(conn)
        log.info("[CRON] Weekly digest generation complete")
    except Exception as e:
        log.error(f"[CRON] Weekly digest failed: {e}")


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 NagarMind backend starting up ...")

    # Init database connection pool
    await init_db()
    log.info("✅ Database pool initialised")

    # Register + start scheduler
    _add_jobs()
    scheduler.start()
    log.info("✅ APScheduler started")

    yield  # ── Application running ──

    log.info("🛑 NagarMind backend shutting down ...")
    scheduler.shutdown(wait=False)
    await close_db()
    log.info("✅ Shutdown complete")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="NagarMind API",
    description="MCD Delhi Civic Intelligence Platform — Backend API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ✅ FIX: Accept all origins to eliminate CORS blocks
    allow_credentials=False, # ✅ FIX: Must be False when origins is "*". JWT works fine.
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(complaints_router, prefix="/api/complaints", tags=["Complaints"])
app.include_router(citizen_router,    prefix="/api/citizen",    tags=["Citizen"])
app.include_router(officer_router,    prefix="/api/officer",    tags=["Officer"])
app.include_router(admin_router,      prefix="/api/admin",      tags=["Admin"])
app.include_router(analytics_router,  prefix="/api/analytics",  tags=["Analytics"])
app.include_router(translate_router,  prefix="/api/translate",  tags=["Translate"])
app.include_router(upload_router,     prefix="/api/upload",     tags=["Upload"])
app.include_router(ward_router,       prefix="/api/wards",       tags=["Ward"])
app.include_router(ws_router,         prefix="",                tags=["WebSocket"])


# ── Health endpoints ──────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "NagarMind API",
        "version": "2.0.0",
        "status": "running",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health", tags=["Health"])
async def health():
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
        "scheduler": "running" if scheduler.running else "stopped",
        "jobs": [
            {"id": job.id, "next_run": str(job.next_run_time)}
            for job in scheduler.get_jobs()
        ],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/admin/cron/trigger/{job_id}", tags=["Admin"])
async def manual_trigger(job_id: str):
    """Manually trigger a scheduled job (admin use only)."""
    job_map = {
        "sla_check":    _run_sla_check,
        "alert_scan":   _run_alert_scan,
        "health_recalc":_run_health_recalc,
        "weekly_digest":_run_weekly_digest,
    }
    if job_id not in job_map:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    import asyncio
    asyncio.create_task(job_map[job_id]())
    return {"message": f"Job '{job_id}' triggered", "timestamp": datetime.now(timezone.utc).isoformat()}