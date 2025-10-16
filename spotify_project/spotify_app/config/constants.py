from google.genai import types
from google.genai.types import Tool, HarmCategory, HarmBlockThreshold

# SSE/Events
ANALYSIS_EVENT_CHANNEL_PREFIX = 'analysis_completion:'
ANALYSIS_EVENT_TIMEOUT = 300
CHAT_EVENT_CHANNEL_PREFIX = 'chat_completion:'
CHAT_EVENT_TIMEOUT = 300

# Model names
NEW_SONGS_MODEL_NAME = "gemini-2.5-flash-preview-09-2025"
SAVED_SONGS_MODEL_NAME = "gemini-2.5-flash-preview-09-2025"
ANALYSIS_CHAT_MODEL_NAME = "gemini-2.5-flash"
INITIAL_ANALYSIS_MODEL_NAME = "gemini-2.5-flash"
FORMATTING_MODEL_NAME = "gemini-2.5-flash"
FEEDBACK_REMOVAL_MODEL_NAME = "gemini-2.5-flash-lite"
PRO_MODEL_NAME = "gemini-2.5-pro"

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
GROUNDING_API_LIMIT = 1500

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

# User-facing messages
MAX_TOKENS_ERROR_MESSAGE = "Aria thought so hard she lost her train of thought. Please resend your message."
HIGH_TRAFFIC_ERROR_MESSAGE = "We are currently experiencing high traffic and were unable to process your message. Please try again in a bit."
LENGTH_TERMINATION_MSG = 'This conversation is dragging on for too long. Save your playlists and then click the three dots (...) and select "Reset" to give me a clean slate.'
EMPTY_PLAYLIST_ERROR_MESSAGE = "Uh oh – I wasn't able to find any tracks that I felt sufficiently matched your criteria. Please revise your prompt and try again."