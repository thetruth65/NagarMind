"""
Multi-key API rotation for Gemini and Sarvam.
Rotates across 4 keys each to spread RPM/RPD load.
Uses round-robin with per-key error tracking and cooldown.
"""
import threading
import time
from typing import List
from app.core.config import settings


class APIKeyRotator:
    """Thread-safe round-robin API key rotator with error cooldown."""

    def __init__(self, keys: List[str], cooldown_seconds: int = 60):
        self._keys = keys
        self._index = 0
        self._lock = threading.Lock()
        self._cooldown = cooldown_seconds
        # error_until[i] = timestamp after which key i is usable again
        self._error_until: dict[int, float] = {}

    def get_key(self) -> str:
        """Get next available key using round-robin."""
        with self._lock:
            now = time.time()
            tried = 0
            while tried < len(self._keys):
                idx = self._index % len(self._keys)
                self._index += 1
                tried += 1
                # Check if key is in cooldown
                if now < self._error_until.get(idx, 0):
                    continue
                return self._keys[idx]
            # All keys in cooldown — return first key anyway
            return self._keys[0]

    def mark_error(self, key: str):
        """Mark a key as errored — put in cooldown."""
        with self._lock:
            try:
                idx = self._keys.index(key)
                self._error_until[idx] = time.time() + self._cooldown
            except ValueError:
                pass

    def available_count(self) -> int:
        now = time.time()
        return sum(1 for i in range(len(self._keys))
                   if now >= self._error_until.get(i, 0))


# Singletons — one rotator per service
_gemini_rotator: APIKeyRotator | None = None
_sarvam_rotator: APIKeyRotator | None = None


def get_gemini_key() -> str:
    global _gemini_rotator
    if _gemini_rotator is None:
        _gemini_rotator = APIKeyRotator(settings.gemini_keys or ["dummy"])
    return _gemini_rotator.get_key()


def get_sarvam_key() -> str:
    global _sarvam_rotator
    if _sarvam_rotator is None:
        _sarvam_rotator = APIKeyRotator(settings.sarvam_keys or ["dummy"])
    return _sarvam_rotator.get_key()


def mark_gemini_error(key: str):
    if _gemini_rotator:
        _gemini_rotator.mark_error(key)


def mark_sarvam_error(key: str):
    if _sarvam_rotator:
        _sarvam_rotator.mark_error(key)