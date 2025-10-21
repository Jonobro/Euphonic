from pathlib import Path
import time
import re
from typing import Any
from django.conf import settings

GROUNDING_USAGE_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'grounding_usage.log'
GEMINI_API_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'gemini_api.log'
SPOTIFY_API_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'spotify_api.log'
GENERAL_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'general.log'
HTTP_REQUEST_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'http_requests.log'

_SANITIZE_MAX_LEN = 60000
_ANSI_ESCAPE_RE = re.compile(r'\x1B\[[0-9;?]*[ -/]*[@-~]')

def _sanitize_log_message(message: Any) -> str:
    try:
        text = str(message)
    except Exception:
        try:
            text = repr(message)
        except Exception:
            text = '<unprintable>'
    text = _ANSI_ESCAPE_RE.sub('', text)
    text = text.replace('\r', ' ').replace('\n', ' ').replace('\t', ' ')
    text = ''.join(ch if (' ' <= ch <= '\uffff' and ch != '\x7f') else ' ' for ch in text)
    text = re.sub(r'\s{2,}', ' ', text).strip()
    if len(text) > _SANITIZE_MAX_LEN:
        text = text[:_SANITIZE_MAX_LEN] + '…'
    return text

def log_to_file(log_file_path, message):
    try:
        sanitized = _sanitize_log_message(message)
        log_file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(log_file_path, 'a', encoding='utf-8', errors='replace') as f:
            timestamp = time.strftime('%Y-%m-%d %H:%M:%S %Z', time.localtime(time.time()))
            f.write(f"{timestamp} - {sanitized}\n")
    except Exception as e:
        print(f"Error writing to log file {log_file_path}: {e}")
        try:
            err_line = _sanitize_log_message(f"Error writing to log file {log_file_path}: {e}")
            with open(GENERAL_LOG_FILE, 'a', encoding='utf-8', errors='replace') as general_log_file:
                general_log_file.write(f"{err_line}\n")
        except Exception:
            pass