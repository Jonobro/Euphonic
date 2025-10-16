from django.conf import settings
from pathlib import Path
from zoneinfo import ZoneInfo
from google.genai import types
from google.genai.types import Tool, HarmCategory, HarmBlockThreshold

__all__ = [
    # SSE/Events
    "ANALYSIS_EVENT_CHANNEL_PREFIX",
    "ANALYSIS_EVENT_TIMEOUT",
    "CHAT_EVENT_CHANNEL_PREFIX",
    "CHAT_EVENT_TIMEOUT",
    "ALLOWED_SSE_ORIGINS",

    # Rate limits
    "RATE_LIMITS",

    # Model names
    "NEW_SONGS_MODEL_NAME",
    "SAVED_SONGS_MODEL_NAME",
    "ANALYSIS_CHAT_MODEL_NAME",
    "INITIAL_ANALYSIS_MODEL_NAME",
    "FORMATTING_MODEL_NAME",
    "FEEDBACK_REMOVAL_MODEL_NAME",
    "PRO_MODEL_NAME",

    # Timezone
    "PACIFIC_TZ",

    # Gemini rate limits and Lua script
    "GEMINI_RATE_LIMITS",
    "GEMINI_LIMIT_LUA",

    # Thinking Budgets
    "NEW_SONGS_THINKING_BUDGET",
    "SAVED_SONGS_THINKING_BUDGET",
    "ANALYSIS_CHAT_THINKING_BUDGET",
    "INITIAL_ANALYSIS_THINKING_BUDGET",

    # Max Output Tokens
    "NEW_SONGS_MAX_OUTPUT_TOKENS",
    "SAVED_SONGS_MAX_OUTPUT_TOKENS",
    "ANALYSIS_CHAT_MAX_OUTPUT_TOKENS",
    "INITIAL_ANALYSIS_MAX_OUTPUT_TOKENS",

    # Temperatures
    "NEW_SONGS_TEMPERATURE",
    "SAVED_SONGS_TEMPERATURE",
    "ANALYSIS_CHAT_TEMPERATURE",
    "INITIAL_ANALYSIS_TEMPERATURE",

    # Grounding/cache keys
    "CACHE_KEY_GROUNDED_TIMESTAMPS",
    "GROUNDING_API_LIMIT",
    "ONE_DAY_IN_SECONDS",

    # Tools/safety
    "GOOGLE_SEARCH_TOOL",
    "SAFETY_SETTINGS",

    # Log file paths
    "GROUNDING_USAGE_LOG_FILE",
    "GEMINI_API_LOG_FILE",
    "SPOTIFY_API_LOG_FILE",
    "GENERAL_LOG_FILE",
    "HTTP_REQUEST_LOG_FILE",

    # User-facing messages
    "MAX_TOKENS_ERROR_MESSAGE",
    "HIGH_TRAFFIC_ERROR_MESSAGE",
    "LENGTH_TERMINATION_MSG",
    "EMPTY_PLAYLIST_ERROR_MESSAGE",
]

# SSE/Events
ANALYSIS_EVENT_CHANNEL_PREFIX = 'analysis_completion:'
ANALYSIS_EVENT_TIMEOUT = 300
CHAT_EVENT_CHANNEL_PREFIX = 'chat_completion:'
CHAT_EVENT_TIMEOUT = 300

ALLOWED_SSE_ORIGINS = {
    "https://euphonicintelligence.com",
    "https://www.euphonicintelligence.com",
}

# Rate limits
RATE_LIMITS = {
    # key_type, limit, window_seconds, block_seconds
    'chat_message': [
        # 100 messages allowed per IP/session per 24 hours with a 24-hour block if max is exceeded
        ('ip', 100, 86400, 86400),
        ('session', 100, 86400, 86400),
        # Global cap across all users. 2000 messages allowed globally per 24 hours.
        ('global', 2000, 86400, None),
    ],
    'playlist_validate': [
        # 24 playlists allowed to be validated per IP/session per minute with a 3-minute block if max is exceeded
        ('ip', 24, 60, 180),
        ('session', 24, 60, 180),
    ],
    'playlist_import': [
        # Playlist import function may be invoked 10 times per IP/session per minute with a 3-minute block if max is exceeded
        ('ip', 10, 60, 180),
        ('session', 10, 60, 180),
    ],
    'chat_initialize': [
        # Limit chat initializations to protect resources and generate_musical_analysis invocation. 10 initializations/min per IP/session.
        ('ip', 10, 60, 180),
        ('session', 10, 60, 180),
    ],
}

# Model names
NEW_SONGS_MODEL_NAME = "gemini-2.5-flash-preview-09-2025"
SAVED_SONGS_MODEL_NAME = "gemini-2.5-flash-preview-09-2025"
ANALYSIS_CHAT_MODEL_NAME = "gemini-2.5-flash"
INITIAL_ANALYSIS_MODEL_NAME = "gemini-2.5-flash"
FORMATTING_MODEL_NAME = "gemini-2.5-flash"
FEEDBACK_REMOVAL_MODEL_NAME = "gemini-2.5-flash-lite"
PRO_MODEL_NAME = "gemini-2.5-pro"

# Timezone
PACIFIC_TZ = ZoneInfo('America/Los_Angeles')

# Gemini rate limits
GEMINI_RATE_LIMITS = {
    'pro':       {'RPM': 2,  'RPD': 50},
    'flash':     {'RPM': 10, 'RPD': 250},
    'flash-lite':{'RPM': 15, 'RPD': 1000},
}

# Redis Lua for Gemini usage limiting
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

# Thinking Budgets
NEW_SONGS_THINKING_BUDGET = -1
SAVED_SONGS_THINKING_BUDGET = 8000
ANALYSIS_CHAT_THINKING_BUDGET = 9000
INITIAL_ANALYSIS_THINKING_BUDGET = 8000

# Max Output Tokens
NEW_SONGS_MAX_OUTPUT_TOKENS = 13000
SAVED_SONGS_MAX_OUTPUT_TOKENS = 26000
ANALYSIS_CHAT_MAX_OUTPUT_TOKENS = 25000
INITIAL_ANALYSIS_MAX_OUTPUT_TOKENS = 20000

# Temperatures
NEW_SONGS_TEMPERATURE = 0.8
SAVED_SONGS_TEMPERATURE = 1.0
ANALYSIS_CHAT_TEMPERATURE = 0.5
INITIAL_ANALYSIS_TEMPERATURE = 0.6

# Grounding/cache keys
CACHE_KEY_GROUNDED_TIMESTAMPS = 'grounded_api_call_timestamps'
GROUNDING_API_LIMIT = 1500
ONE_DAY_IN_SECONDS = 24 * 60 * 60

# Tools/safety
GOOGLE_SEARCH_TOOL = Tool(google_search=types.GoogleSearch())

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

# Log file paths
GROUNDING_USAGE_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'grounding_usage.log'
GEMINI_API_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'gemini_api.log'
SPOTIFY_API_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'spotify_api.log'
GENERAL_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'general.log'
HTTP_REQUEST_LOG_FILE = Path(settings.BASE_DIR) / 'logs' / 'custom_logs' / 'http_requests.log'

# User-facing messages
MAX_TOKENS_ERROR_MESSAGE = "Aria thought so hard she lost her train of thought. Please resend your message."
HIGH_TRAFFIC_ERROR_MESSAGE = "We are currently experiencing high traffic and were unable to process your message. Please try again in a bit."
LENGTH_TERMINATION_MSG = 'This conversation is dragging on for too long. Save your playlists and then click the three dots (...) and select "Reset" to give me a clean slate.'
EMPTY_PLAYLIST_ERROR_MESSAGE = "Uh oh – I wasn't able to find any tracks that I felt sufficiently matched your criteria. Please revise your prompt and try again."