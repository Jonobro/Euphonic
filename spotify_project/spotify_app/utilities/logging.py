from pathlib import Path
import time
from django.conf import settings

GROUNDING_USAGE_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'grounding_usage.log'
GEMINI_API_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'gemini_api.log'
SPOTIFY_API_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'spotify_api.log'
GENERAL_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'general.log'
HTTP_REQUEST_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'http_requests.log'

def log_to_file(log_file_path, message):
    try:
        log_file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(log_file_path, 'a') as f:
            timestamp = time.strftime('%Y-%m-%d %H:%M:%S %Z', time.localtime(time.time()))
            f.write(f"{timestamp} - {message}\n")
    except Exception as e:
        print(f"Error writing to log file {log_file_path}: {e}")
        with open(GENERAL_LOG_FILE, 'a') as general_log_file:
            general_log_file.write(f"Error writing to log file {log_file_path}: {e}\n")