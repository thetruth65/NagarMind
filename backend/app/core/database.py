"""
NagarMind Backend — Database Connection Pool
asyncpg-based PostgreSQL pool with FastAPI dependency helper.
"""

from __future__ import annotations

import asyncpg
from asyncpg import Pool, Connection
from typing import AsyncGenerator

from app.core.config import settings

import logging
log = logging.getLogger("nagarmind.db")

# ── Module-level pool singleton ───────────────────────────────────────────────

_pool: Pool | None = None


# ── Lifecycle functions (called from main.py lifespan) ────────────────────────

async def init_db() -> None:
    """Create the asyncpg connection pool. Called once on startup."""
    global _pool
    if _pool is not None:
        log.warning("init_db called but pool already exists — skipping")
        return

    # asyncpg doesn't understand "postgresql+asyncpg://" — strip the dialect
    dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=10,
        command_timeout=60,
        server_settings={"application_name": "nagarmind"},
    )
    log.info(f"✅ asyncpg pool created (min=2, max=10) → {settings.DATABASE_URL[:40]}...")


async def close_db() -> None:
    """Close the asyncpg pool. Called once on shutdown."""
    global _pool
    if _pool is None:
        return
    await _pool.close()
    _pool = None
    log.info("✅ asyncpg pool closed")


async def get_db_pool() -> Pool:
    """
    Return the live pool.
    Used by main.py cron wrappers and the /health endpoint.
    Raises RuntimeError if init_db() was never called.
    """
    if _pool is None:
        raise RuntimeError("Database pool is not initialised. Call init_db() first.")
    return _pool


# ── FastAPI dependency ────────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[Connection, None]:
    """
    FastAPI dependency — yields a single asyncpg connection from the pool.

    Usage in routes:
        async def my_route(conn: Connection = Depends(get_db)):
            ...
    """
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        yield conn