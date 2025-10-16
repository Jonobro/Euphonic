from urllib.parse import urlparse

ALLOWED_SSE_ORIGINS = {
    "https://euphonicintelligence.com",
    "https://www.euphonicintelligence.com",
}

def sse_same_origin_ok(request):
    origin = request.META.get("HTTP_ORIGIN")
    referer = request.META.get("HTTP_REFERER")
    if origin:
        if origin.rstrip("/") in ALLOWED_SSE_ORIGINS:
            return True
    if referer:
        try:
            p = urlparse(referer)
            base = f"{p.scheme}://{p.netloc}"
            if base in ALLOWED_SSE_ORIGINS:
                return True
        except Exception:
            pass
    return False