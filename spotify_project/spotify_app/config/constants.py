# SSE/Events
ANALYSIS_EVENT_CHANNEL_PREFIX = 'analysis_completion:'
ANALYSIS_EVENT_TIMEOUT = 300
CHAT_EVENT_CHANNEL_PREFIX = 'chat_completion:'
CHAT_EVENT_TIMEOUT = 300

# Model names
NEW_SONGS_MODEL_NAME = "gemini-3-flash-preview"
SAVED_SONGS_MODEL_NAME = "gemini-3-flash-preview"
ANALYSIS_CHAT_MODEL_NAME = "gemini-3-flash-preview"
INITIAL_ANALYSIS_MODEL_NAME = "gemini-3-flash-preview"
FORMATTING_MODEL_NAME = "gemini-3-flash-preview"
FEEDBACK_REMOVAL_MODEL_NAME = "gemini-2.5-flash-lite"
PRO_MODEL_NAME = "gemini-3-flash-preview"

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

# User-facing messages
MAX_TOKENS_ERROR_MESSAGE = "Aria thought so hard she lost her train of thought. Please resend your message."
HIGH_TRAFFIC_ERROR_MESSAGE = "We are currently experiencing high traffic and were unable to process your message. Please try again in a bit."
LENGTH_TERMINATION_MSG = 'This conversation is dragging on for too long. Save your playlists and then click the three dots (...) and select "Reset" to give me a clean slate.'
EMPTY_PLAYLIST_ERROR_MESSAGE = "Uh oh – I wasn't able to find any tracks that I felt sufficiently matched your criteria. Please revise your prompt and try again."