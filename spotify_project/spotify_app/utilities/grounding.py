import time
from django.core.cache import cache
from django_redis import get_redis_connection
from .timeutils import pacific_now, seconds_until_pacific_midnight
from .logging import GROUNDING_USAGE_LOG_FILE, GENERAL_LOG_FILE, log_to_file
from ..config.constants import GROUNDING_API_LIMIT

def check_and_update_grounding_usage():
    try:
        today_str = pacific_now().strftime('%Y%m%d')
    except Exception:
        today_str = time.strftime('%Y%m%d', time.gmtime())

    cache_key = f"grounding_usage_count:{today_str}"
    ttl_seconds = seconds_until_pacific_midnight() + 300

    can_use_grounding = False
    count = None

    try:
        redis = get_redis_connection("default")

        lua_script = """
        local key = KEYS[1]
        local ttl = tonumber(ARGV[1])
        local limit = tonumber(ARGV[2])
        local val = redis.call('GET', key)
        if not val then
          redis.call('SET', key, 0, 'EX', ttl)
          val = '0'
        end
        val = tonumber(val)
        if val < limit then
          local newval = redis.call('INCR', key)
          if redis.call('TTL', key) == -1 then redis.call('EXPIRE', key, ttl) end
          return {1, newval}
        else
          return {0, val}
        end
        """

        result = redis.eval(lua_script, 1, cache_key, ttl_seconds, GROUNDING_API_LIMIT)
        can_use_grounding = bool(result[0] == 1)
        count = int(result[1])
    except Exception:
        count = cache.get(cache_key)
        if count is None:
            count = 0
            cache.set(cache_key, count, timeout=ttl_seconds)

        can_use_grounding = count < GROUNDING_API_LIMIT
        if can_use_grounding:
            count += 1
            cache.set(cache_key, count, timeout=ttl_seconds)

    try:
        current_time = time.time()
        log_timestamp = time.strftime('%Y-%m-%d %H:%M:%S %Z', time.localtime(current_time))
        GROUNDING_USAGE_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(GROUNDING_USAGE_LOG_FILE, 'a') as f:
            f.write(f"{log_timestamp} - Grounding usage (Pacific day {today_str}) BEFORE request: {count - (1 if can_use_grounding else 0)} / {GROUNDING_API_LIMIT}\n")
            if can_use_grounding:
                f.write(f"{log_timestamp} - Grounding USED for this request. New count: {count}\n")
            else:
                f.write(f"{log_timestamp} - Grounding NOT USED (daily limit reached). Count: {count}\n")
    except Exception as e:
        log_to_file(GENERAL_LOG_FILE, f"Error writing to grounding usage log: {e}")
    return can_use_grounding