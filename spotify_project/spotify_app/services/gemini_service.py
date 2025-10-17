from django.conf import settings
from django.core.mail import send_mail
from google import genai
from google.genai import types
from google.genai.types import Tool, HarmCategory, HarmBlockThreshold
from scripts.metrics_store import record_gemini_request
from ..utilities.logging import log_to_file, GEMINI_API_LOG_FILE, GENERAL_LOG_FILE
from ..utilities.timeutils import pacific_now, seconds_until_pacific_midnight
from ..utilities.redis_utils import REDIS_CLIENT, redis_available

GEMINI_CLIENT_CACHE = {}
GOOGLE_SEARCH_TOOL = Tool(google_search=types.GoogleSearch())

GEMINI_RATE_LIMITS = {
    'pro':       {'RPM': 2,  'RPD': 50},
    'flash':     {'RPM': 10, 'RPD': 250},
    'flash-lite':{'RPM': 15, 'RPD': 1000},
}

SAFETY_SETTINGS = [
    {
        "category": HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        "threshold": HarmBlockThreshold.BLOCK_NONE,
    },
    {
        "category": HarmCategory.HARM_CATEGORY_HARASSMENT,
        "threshold": HarmBlockThreshold.BLOCK_NONE,
    },
    {
        "category": HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        "threshold": HarmBlockThreshold.BLOCK_NONE,
    },
    {
        "category": HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        "threshold": HarmBlockThreshold.BLOCK_NONE,
    },
]

GEMINI_LIMIT_LUA = """
local daily_key = KEYS[1]
local minute_key = KEYS[2]
local daily_limit = tonumber(ARGV[1])
local minute_limit = tonumber(ARGV[2])
local daily_ttl_ms = tonumber(ARGV[3])
local minute_ttl_s = tonumber(ARGV[4])

local daily_count = tonumber(redis.call('GET', daily_key) or "0")
local minute_count = tonumber(redis.call('GET', minute_key) or "0")

if daily_count >= daily_limit or minute_count >= minute_limit then
  return {0, daily_count, minute_count}
end

daily_count = redis.call('INCR', daily_key)
if daily_count == 1 then
  redis.call('PEXPIRE', daily_key, daily_ttl_ms)
end

minute_count = redis.call('INCR', minute_key)
if minute_count == 1 then
  redis.call('EXPIRE', minute_key, minute_ttl_s)
end

return {1, daily_count, minute_count}
"""

def _classify_gemini_model(model_name: str):
    m = (model_name or "").lower()
    if 'pro' in m:
        return 'pro'
    if 'flash-lite' in m:
        return 'flash-lite'
    if 'flash-preview' in m:
        return 'flash-preview'
    if 'flash' in m:
        return 'flash'
    return 'flash'

def _compute_request_cost(response):
    try:
        usage = getattr(response, "usage_metadata", None)
        if not usage:
            return 0.0
        
        cached_content_token_count = int(getattr(usage, "cached_content_token_count", 0) or 0)
        candidates_token_count = int(getattr(usage, "candidates_token_count", 0) or 0)
        prompt_token_count = int(getattr(usage, "prompt_token_count", 0) or 0)
        thoughts_token_count = int(getattr(usage, "thoughts_token_count", 0) or 0)
        tool_use_prompt_token_count = int(getattr(usage, "tool_use_prompt_token_count", 0) or 0)

        model_name = getattr(response, "model_version", None)
        if not model_name:
            return 0.0
        
        total_output_tokens = candidates_token_count + thoughts_token_count
        total_cached_tokens = cached_content_token_count
        total_input_tokens = prompt_token_count + tool_use_prompt_token_count

        try:
            pricing_map = getattr(settings, "GEMINI_PRICING", None)
            if not isinstance(pricing_map, dict):
                return 0.0
        except Exception:
            return 0.0

        model_tier = _classify_gemini_model(model_name)

        rates = pricing_map.get(model_tier)
        if not rates:
            return 0.0
        
        input_rate = float(rates.get("input_per_million", 0.0) or 0.0)
        output_rate = float(rates.get("output_per_million", 0.0) or 0.0)
        cached_rate = float(rates.get("cached_per_million", 0.0) or 0.0)

        million = 1000000.0
        cost = (
            (total_input_tokens) * (input_rate / million)
            + (total_output_tokens) * (output_rate / million)
            + (total_cached_tokens) * (cached_rate / million)
        )
        return float(cost)
    except Exception:
        return 0.0

def _record_gemini_usage_safe(user_id, response, gemini_key):
    try:
        if gemini_key == 'primary':
            cost = 0.0
        else:
            cost = _compute_request_cost(response)
        record_gemini_request(user_id, cost)
    except Exception as e:
        try:
            log_to_file(GENERAL_LOG_FILE, f"Failed to record Gemini metrics: {e}")
        except Exception:
            pass

def _is_transient_gemini_error(e: Exception):
    http_status = None
    code_name = None

    try:
        for attr in ('status', 'code', 'error_code', 'reason'):
            val = getattr(e, attr, None)
            if isinstance(val, str) and val.strip():
                code_name = val.strip().upper()
                break

        for attr in ('status', 'status_code', 'http_status', 'code'):
            val = getattr(e, attr, None)
            if isinstance(val, int):
                http_status = val
                break

        if http_status is None and hasattr(e, 'response'):
            resp = getattr(e, 'response', None)
            http_status = getattr(resp, 'status_code', None)
            try:
                j = resp.json() if callable(getattr(resp, 'json', None)) else None
                if isinstance(j, dict):
                    inner = j.get('error') or {}
                    if isinstance(inner, dict):
                        status_name = inner.get('status')
                        if isinstance(status_name, str) and status_name.strip():
                            code_name = status_name.strip().upper()
                        code_int = inner.get('code')
                        if isinstance(code_int, int) and http_status is None:
                            http_status = code_int
            except Exception:
                pass
    except Exception:
        pass

    NON_TRANSIENT_NAMES = {
        'INVALID_ARGUMENT',       # 400
        'FAILED_PRECONDITION',    # 400
        'PERMISSION_DENIED',      # 403
        'NOT_FOUND',              # 404
    }
    TRANSIENT_NAMES = {
        'RESOURCE_EXHAUSTED',     # 429
        'UNAVAILABLE',            # 503
        'DEADLINE_EXCEEDED',      # 504
        'INTERNAL',               # 500
        'UNKNOWN',                # 500
        'CANCELLED',              # 499
    }

    if isinstance(code_name, str):
        if code_name in TRANSIENT_NAMES:
            return True
        if code_name in NON_TRANSIENT_NAMES:
            return False

    NON_TRANSIENT_HTTP = {400, 403, 404}
    TRANSIENT_HTTP = {429, 500, 503, 504, 499}

    if isinstance(http_status, int):
        if http_status in TRANSIENT_HTTP:
            return True
        if http_status in NON_TRANSIENT_HTTP:
            return False

    return False

def _is_resource_exhausted_error(e: Exception):
    http_status = None
    code_name = None

    try:
        for attr in ('status', 'code', 'error_code', 'reason'):
            val = getattr(e, attr, None)
            if isinstance(val, str) and val.strip():
                code_name = val.strip().upper()
                break

        for attr in ('status', 'status_code', 'http_status', 'code'):
            val = getattr(e, attr, None)
            if isinstance(val, int):
                http_status = val
                break

        if (http_status is None or code_name is None) and hasattr(e, 'response'):
            resp = getattr(e, 'response', None)
            if resp is not None:
                http_status = getattr(resp, 'status_code', http_status)
                try:
                    j = resp.json() if callable(getattr(resp, 'json', None)) else None
                    if isinstance(j, dict):
                        inner = j.get('error') or {}
                        if isinstance(inner, dict):
                            status_name = inner.get('status')
                            if isinstance(status_name, str) and status_name.strip():
                                code_name = status_name.strip().upper()
                except Exception:
                    pass
    except Exception:
        pass

    if isinstance(code_name, str) and code_name == 'RESOURCE_EXHAUSTED':
        return True
    if isinstance(http_status, int) and http_status == 429:
        return True
    return False

def _send_gemini_rate_limit_alert(tier, model_name, daily_count, minute_count, limits, triggered_types):
    try:
        alert_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None)
        recipient_email = getattr(settings, 'DEFAULT_TO_EMAIL', None)
        if not alert_email:
            return
        triggered_label = "+".join(triggered_types)
        date_str = pacific_now().strftime('%Y%m%d')
        suppress_key = f"gemini_rl_alert:{date_str}:{tier}:{triggered_label}"
        ttl_seconds = 60 if 'minute' in triggered_types and 'daily' not in triggered_types else seconds_until_pacific_midnight()
        try:
            if redis_available():
                if REDIS_CLIENT.get(suppress_key):
                    return
                REDIS_CLIENT.set(suppress_key, 1, ex=ttl_seconds)
        except Exception:
            pass
        subject = f"[Gemini Rate Limit Triggered] tier={tier} type={triggered_label}"
        body = (
            f"Gemini API rate limit reached.\n"
            f"Model Requested: {model_name}\n"
            f"Tier: {tier}\n"
            f"Triggered: {triggered_label}\n"
            f"Minute Usage: {minute_count}/{limits['RPM']}\n"
            f"Daily Usage: {daily_count}/{limits['RPD']}\n"
            f"Time (Pacific): {pacific_now().isoformat()}\n"
        )
        send_mail(subject, body, alert_email, [recipient_email], fail_silently=True)
    except Exception as e:
        log_to_file(GENERAL_LOG_FILE, f"Failed to send Gemini rate limit alert (tier={tier}): {e}")

def _choose_gemini_client(model_name: str):
    tier = _classify_gemini_model(model_name)
    if tier == 'flash-preview':
        tier = 'flash'
    
    limits = GEMINI_RATE_LIMITS.get(tier)
    if not limits:
        if 'fallback' not in GEMINI_CLIENT_CACHE:
            GEMINI_CLIENT_CACHE['fallback'] = genai.Client(api_key=getattr(settings, 'GEMINI_API_KEY_FALLBACK', None))
        return GEMINI_CLIENT_CACHE['fallback'], 'fallback'
    
    if not redis_available():
        if 'fallback' not in GEMINI_CLIENT_CACHE:
            GEMINI_CLIENT_CACHE['fallback'] = genai.Client(api_key=getattr(settings, 'GEMINI_API_KEY_FALLBACK', None))
        log_to_file(GEMINI_API_LOG_FILE, f"[GEMINI_FALLBACK] Redis unavailable -> using FALLBACK key for model {model_name}")
        return GEMINI_CLIENT_CACHE['fallback'], 'fallback'
    
    date_str = pacific_now().strftime('%Y%m%d')
    current_minute = pacific_now().strftime('%Y%m%d%H%M')
    daily_key = f"gemini:usage:{date_str}:{tier}:daily"
    minute_key = f"gemini:usage:{date_str}:{tier}:min:{current_minute}"
    
    ttl_daily_ms = seconds_until_pacific_midnight() * 1000
    minute_ttl_s = 90
    
    try:
        allowed, daily_count, minute_count = REDIS_CLIENT.eval(
            GEMINI_LIMIT_LUA,
            2,
            daily_key, minute_key,
            limits['RPD'], limits['RPM'], ttl_daily_ms, minute_ttl_s
        )
    except Exception as e:
        log_to_file(GEMINI_API_LOG_FILE, f"[GEMINI_FALLBACK] Redis eval error '{e}' -> using FALLBACK key for {model_name}")
        if 'fallback' not in GEMINI_CLIENT_CACHE:
            GEMINI_CLIENT_CACHE['fallback'] = genai.Client(api_key=getattr(settings, 'GEMINI_API_KEY_FALLBACK', None))
        return GEMINI_CLIENT_CACHE['fallback'], 'fallback'
    
    if allowed == 1:
        if 'primary' not in GEMINI_CLIENT_CACHE:
            GEMINI_CLIENT_CACHE['primary'] = genai.Client(api_key=getattr(settings, 'GEMINI_API_KEY_PRIMARY', None))
        log_to_file(GEMINI_API_LOG_FILE, f"[GEMINI_USAGE] PRIMARY key used | model={model_name} tier={tier} daily={daily_count}/{limits['RPD']} minute={minute_count}/{limits['RPM']}")
        return GEMINI_CLIENT_CACHE['primary'], 'primary'
    else:
        triggered = []
        if daily_count >= limits['RPD']:
            triggered.append('daily')
        if minute_count >= limits['RPM']:
            triggered.append('minute')
        if triggered:
            _send_gemini_rate_limit_alert(tier, model_name, daily_count, minute_count, limits, triggered)
        if 'fallback' not in GEMINI_CLIENT_CACHE:
            GEMINI_CLIENT_CACHE['fallback'] = genai.Client(api_key=getattr(settings, 'GEMINI_API_KEY_FALLBACK', None))
        log_to_file(GEMINI_API_LOG_FILE, f"[GEMINI_FALLBACK] Switching to FALLBACK key | model={model_name} tier={tier} daily={daily_count}/{limits['RPD']} minute={minute_count}/{limits['RPM']} triggered={'+'.join(triggered) or 'unknown'}")
        return GEMINI_CLIENT_CACHE['fallback'], 'fallback'