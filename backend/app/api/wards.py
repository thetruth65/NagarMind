"""Ward listing and digest API."""
from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_db

router = APIRouter(tags=["wards"])

@router.get("/")
async def list_wards(pool=Depends(get_db)):
    rows = await pool.fetch("SELECT ward_id, ward_name, zone, health_score, health_grade FROM wards ORDER BY ward_name ASC")
    return [dict(r) for r in rows]

@router.get("/health/all")
async def all_ward_health(pool=Depends(get_db)):
    rows = await pool.fetch("SELECT ward_id, ward_name, zone, health_score, health_grade, lat_center, lng_center FROM (SELECT w.*, (SELECT COUNT(*) FROM complaints c WHERE c.ward_id=w.ward_id AND status NOT IN ('resolved','closed')) as open_count, (SELECT COUNT(*) FROM complaints c WHERE c.ward_id=w.ward_id AND resolved_at > NOW() - INTERVAL '7 days') as resolved_week, (SELECT COUNT(*) FROM complaints c WHERE c.ward_id=w.ward_id AND sla_breached=TRUE) as overdue_count FROM wards w) as stats")
    return[dict(r) for r in rows]

# ✅ FIX: This MUST be placed above `/{ward_id}`
@router.get("/digests/history")
async def get_digest_history(type: str, entity_id: str = None, pool=Depends(get_db)):
    if type == 'city':
        rows = await pool.fetch("SELECT * FROM weekly_digests WHERE digest_type='city' ORDER BY week_start DESC")
        entity_name = "MCD Delhi"
    elif type == 'zone':
        rows = await pool.fetch("SELECT * FROM weekly_digests WHERE digest_type='zone' AND zone_name=$1 ORDER BY week_start DESC", entity_id)
        entity_name = f"{entity_id} Zone"
    else: 
        if not entity_id or not entity_id.isdigit():
            raise HTTPException(400, "Ward ID must be a number")
        rows = await pool.fetch("SELECT * FROM weekly_digests WHERE digest_type='ward' AND ward_id=$1 ORDER BY week_start DESC", int(entity_id))
        w = await pool.fetchrow("SELECT ward_name FROM wards WHERE ward_id=$1", int(entity_id))
        entity_name = w['ward_name'] if w else f"Ward {entity_id}"

    res =[]
    for r in rows:
        d = dict(r)
        d['ward_name'] = entity_name
        res.append(d)
    return {"digests": res}

@router.get("/digest/{digest_id}")
async def get_digest_by_id(digest_id: str, pool=Depends(get_db)):
    row = await pool.fetchrow("SELECT * FROM weekly_digests WHERE digest_id = $1", digest_id)
    if not row: raise HTTPException(404, "Digest not found")
    return dict(row)

# ✅ CATCH-ALL ROUTE GOES AT THE VERY BOTTOM
@router.get("/{ward_id}")
async def get_ward_detail(ward_id: int, pool=Depends(get_db)):
    row = await pool.fetchrow("SELECT * FROM wards WHERE ward_id=$1", ward_id)
    if not row: raise HTTPException(404)
    return dict(row)