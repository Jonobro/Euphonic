import time
import subprocess
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

def seconds_until_next_pst_midnight() -> int:
    now = datetime.now(ZoneInfo("America/Los_Angeles"))
    next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((next_midnight - now).total_seconds()))

def main():
    while True:
        sleep_s = seconds_until_next_pst_midnight()
        print(f"[daily-reporter] Sleeping {sleep_s} seconds until midnight PT...", flush=True)
        time.sleep(sleep_s)
        try:
            print("[daily-reporter] Running daily report...", flush=True)
            subprocess.run([sys.executable, "manage.py", "send_daily_gemini_report"], check=True)
        except subprocess.CalledProcessError as e:
            print(f"[daily-reporter] send_daily_gemini_report failed: {e}", flush=True)
        time.sleep(5)

if __name__ == "__main__":
    main()