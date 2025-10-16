from zoneinfo import ZoneInfo
from datetime import datetime, timedelta

PACIFIC_TZ = ZoneInfo('America/Los_Angeles')

def pacific_now():
    return datetime.now(PACIFIC_TZ)

def seconds_until_pacific_midnight():
    now = pacific_now()
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int((tomorrow - now).total_seconds())