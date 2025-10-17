import uuid
from ..utilities.logging import log_to_file, GENERAL_LOG_FILE

def _is_crawler(request):
    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    if not user_agent:
        return False
    crawler_patterns = [
        'bot', 'crawler', 'scraper', 'checker', 'spider', 'slurp', 
        'googlebot', 'bingbot', 'yahoobot', 'duckduckbot', 
        'baiduspider', 'yandexbot', 'facebookexternalhit', 
        'twitterbot', 'linkedinbot', 'applebot', 'petalbot',
        'msnbot', 'slackbot', 'discordbot', 'whatsapp',
        'telegrambot', 'pinterest', 'redditbot'
    ]
    return any(pattern in user_agent for pattern in crawler_patterns)

def ensure_euphonic_intelligence_user_id(request):
    if _is_crawler(request):
        log_to_file(GENERAL_LOG_FILE, f"Crawler detected, skipping user ID generation. UA: {request.META.get('HTTP_USER_AGENT', '')}")
        return None

    if not request.session.get('euphonic_intelligence_user_id'):
        euphonic_user_id = str(uuid.uuid4())
        request.session['euphonic_intelligence_user_id'] = euphonic_user_id
        request.session.modified = True
        if not request.session.session_key:
            request.session.save()
        log_to_file(GENERAL_LOG_FILE, f"Generated new euphonic_intelligence_user_id: {euphonic_user_id} for session {request.session.session_key}")
    return request.session['euphonic_intelligence_user_id']