from functools import wraps
from django.http import JsonResponse
from django.core.mail import send_mail
from django.core.cache import cache
from django.conf import settings
from .logging import log_to_file, GENERAL_LOG_FILE
from ..config.constants import HIGH_TRAFFIC_ERROR_MESSAGE
from .redis_utils import redis_available, REDIS_CLIENT

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
    'playlist_create': [
        # Limit playlist creation to 6 requests per IP/session per minute with a 3-minute block if max is exceeded
        ('ip', 6, 60, 180),
        ('session', 6, 60, 180),
    ],
}

def _rl_keys(request, scope, key_type):
    ip = (request.META.get('HTTP_CF_CONNECTING_IP')
          or request.META.get('HTTP_X_REAL_IP')
          or request.META.get('REMOTE_ADDR')
          or 'unknown')
    session_key = request.session.session_key or 'no-session'
    base_map = {
        'ip': ip,
        'session': session_key,
        'global': 'global'
    }
    ident = base_map[key_type]
    return f"rl:{scope}:{key_type}:{ident}", f"rlblk:{scope}:{key_type}:{ident}"

def _incr_with_expire(store, key, window):
    if redis_available() and store is REDIS_CLIENT:
        lua_script = """
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then
            redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        return current
        """
        try:
            return store.eval(lua_script, 1, key, window)
        except Exception:
            count = store.incr(key)
            if count == 1:
                store.expire(key, window)
            return count
    val = cache.get(key, 0) + 1
    cache.set(key, val, timeout=window)
    return val

def _send_rate_limit_alert(scope, key_type, ident, count, limit, window, block_duration):
    try:
        alert_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None)
        recipient_email = getattr(settings, 'DEFAULT_TO_EMAIL', None)
        if not alert_email:
            return
        if redis_available():
            suppress_ttl = block_duration or window
            rl_alert_key = f"rlalert:{scope}:{key_type}:{ident}"
            if REDIS_CLIENT.get(rl_alert_key):
                return
            REDIS_CLIENT.set(rl_alert_key, 1, ex=suppress_ttl)
        subject = f"[Rate Limit Triggered] scope={scope} type={key_type}"
        body = (
            f"Rate limit exceeded.\n"
            f"Scope: {scope}\n"
            f"Key Type: {key_type}\n"
            f"Identifier: {ident}\n"
            f"Count: {count}\n"
            f"Limit: {limit}\n"
            f"Window (s): {window}\n"
            f"Block Duration (s): {block_duration or 'window'}\n"
        )
        send_mail(subject, body, alert_email, [recipient_email], fail_silently=True)
    except Exception as e:
        log_to_file(GENERAL_LOG_FILE, f"Failed to send rate limit alert (scope={scope}, key_type={key_type}, ident={ident}): {e}")

def rate_limit_scope(scope):
    rules = RATE_LIMITS.get(scope, [])
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            for key_type, limit, window, block in rules:
                counter_key, block_key = _rl_keys(request, scope, key_type)
                try:
                    if REDIS_CLIENT.get(block_key):
                        msg = (HIGH_TRAFFIC_ERROR_MESSAGE
                               if key_type == 'global'
                               else 'Rate limit exceeded. Please try again later.')
                        return JsonResponse({'error': msg}, status=429)
                except Exception:
                    pass
                count = _incr_with_expire(REDIS_CLIENT, counter_key, window)
                if count > limit:
                    try:
                        block_duration = block
                        if block_duration is None:
                            try:
                                ttl = REDIS_CLIENT.ttl(counter_key)
                            except Exception:
                                ttl = -1
                            if ttl is None or ttl < 0:
                                ttl = window
                            block_duration = ttl
                        REDIS_CLIENT.set(block_key, 1, ex=block_duration)
                        try:
                            ident = counter_key.split(':')[-1]
                            _send_rate_limit_alert(scope, key_type, ident, count, limit, window, block_duration)
                        except Exception as alert_err:
                            log_to_file(GENERAL_LOG_FILE, f"Error scheduling rate limit alert: {alert_err}")
                    except Exception:
                        pass
                    log_to_file(GENERAL_LOG_FILE,f"Rate limit exceeded ({scope}:{key_type}) key={counter_key} count={count} limit={limit}")
                    msg = (HIGH_TRAFFIC_ERROR_MESSAGE
                           if key_type == 'global'
                           else 'Rate limit exceeded. Please try again later.')
                    return JsonResponse({'error': msg}, status=429)
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator