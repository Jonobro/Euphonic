from django.conf import settings

REDIS_CLIENT = settings.REDIS_CLIENT

def redis_available():
    try:
        REDIS_CLIENT.ping()
        return True
    except Exception:
        return False