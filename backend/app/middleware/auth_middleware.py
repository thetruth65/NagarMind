from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_token
from app.core.database import get_db

security = HTTPBearer(auto_error=False)

def _require_role(*allowed_roles: str):
    async def dep(
        creds: HTTPAuthorizationCredentials = Depends(security),
        pool=Depends(get_db),
    ):
        if not creds:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        payload = decode_token(creds.credentials)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        role = payload.get("role")
        
        # ✅ FIX: Properly convert to list for checking
        allowed = list(allowed_roles)
        if "officer" in allowed and "admin" not in allowed:
            allowed.append("admin")
            
        if role not in allowed:
            raise HTTPException(status_code=403, detail=f"Role '{role}' not allowed. Requires: {allowed}")
            
        return payload
    return dep

require_citizen = _require_role("citizen")
require_officer = _require_role("officer", "admin")
require_admin   = _require_role("admin")
require_any     = _require_role("citizen", "officer", "admin")