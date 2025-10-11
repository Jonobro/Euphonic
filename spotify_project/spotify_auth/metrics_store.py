from __future__ import annotations
import json
from datetime import date
from pathlib import Path
from threading import Lock
from typing import Dict, List, TypedDict
from django.conf import settings
from django.utils import timezone
from zoneinfo import ZoneInfo

_METRICS_LOCK = Lock()

BASE_DIR = Path(settings.BASE_DIR)
METRICS_DIR = BASE_DIR / "logs" / "custom_logs"
METRICS_DIR.mkdir(parents=True, exist_ok=True)
METRICS_FILE = METRICS_DIR / "daily_metrics.json"

class DayMetrics(TypedDict, total=False):
    gemini_requests: int
    token_cost: float
    playlists_created: int
    unique_users: List[str]

def _today_str() -> str:
    pst = ZoneInfo("America/Los_Angeles")
    return timezone.now().astimezone(pst).date().isoformat()

def _date_str(d: date | str | None = None) -> str:
    if d is None:
        return _today_str()
    if isinstance(d, str):
        return d
    return d.isoformat()

def _load_all() -> Dict[str, DayMetrics]:
    if not METRICS_FILE.exists():
        return {}
    try:
        with METRICS_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
            for v in data.values():
                v.setdefault("gemini_requests", 0)
                v.setdefault("token_cost", 0.0)
                v.setdefault("playlists_created", 0)
                v.setdefault("unique_users", [])
            return data
    except Exception:
        return {}

def _atomic_write(path: Path, content: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        f.write(content)
    tmp.replace(path)

def _save_all(all_metrics: Dict[str, DayMetrics]) -> None:
    payload = json.dumps(all_metrics, indent=2, sort_keys=True)
    _atomic_write(METRICS_FILE, payload)

def _ensure_day(metrics: Dict[str, DayMetrics], day: str) -> DayMetrics:
    if day not in metrics:
        metrics[day] = DayMetrics(
            gemini_requests=0,
            token_cost=0.0,
            playlists_created=0,
            unique_users=[],
        )
    else:
        m = metrics[day]
        m.setdefault("gemini_requests", 0)
        m.setdefault("token_cost", 0.0)
        m.setdefault("playlists_created", 0)
        m.setdefault("unique_users", [])
    return metrics[day]

def _add_user(day_metrics: DayMetrics, user_id: str) -> None:
    if not user_id:
        return
    users = day_metrics.get("unique_users", [])
    if user_id not in users:
        users.append(user_id)
    day_metrics["unique_users"] = users

def record_gemini_request(user_id: str, token_cost: float) -> None:
    day = _today_str()
    with _METRICS_LOCK:
        all_metrics = _load_all()
        m = _ensure_day(all_metrics, day)
        m["gemini_requests"] += 1
        m["token_cost"] = float(m.get("token_cost", 0.0)) + float(max(0.0, token_cost))
        _add_user(m, user_id)
        _save_all(all_metrics)

def record_playlist_created(user_id: str) -> None:
    day = _today_str()
    with _METRICS_LOCK:
        all_metrics = _load_all()
        m = _ensure_day(all_metrics, day)
        m["playlists_created"] += 1
        _add_user(m, user_id)
        _save_all(all_metrics)

def get_metrics_for_date(day: date | str) -> DayMetrics:
    key = _date_str(day)
    all_metrics = _load_all()
    return _ensure_day(all_metrics, key).copy()