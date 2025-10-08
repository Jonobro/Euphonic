import requests
from django.core.mail.backends.base import BaseEmailBackend
from django.conf import settings

class MailgunEmailBackend(BaseEmailBackend):
    api_base = "https://api.mailgun.net/v3"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.api_key = getattr(settings, "MAILGUN_API_KEY", None)
        self.domain = getattr(settings, "MAILGUN_DOMAIN", None)
        if not self.api_key or not self.domain:
            if self.fail_silently:
                return
            raise ValueError("MAILGUN_API_KEY and MAILGUN_DOMAIN must be set.")

    def send_messages(self, email_messages):
        if not email_messages or not self.api_key or not self.domain:
            return 0
        sender = settings.DEFAULT_FROM_EMAIL
        sent = 0
        for message in email_messages:
            if not message.to:
                continue
            html_body = None
            if getattr(message, "alternatives", None):
                for ct, body in message.alternatives:
                    if ct == "text/html":
                        html_body = body
                        break
            data = {
                "from": sender,
                "to": list(message.to),
                "subject": message.subject or "",
            }
            if html_body or message.content_subtype == "html":
                data["html"] = html_body or message.body
                if message.content_subtype == "plain":
                    data["text"] = message.body
            else:
                data["text"] = message.body
            try:
                resp = requests.post(
                    f"{self.api_base}/{self.domain}/messages",
                    auth=("api", self.api_key),
                    data=data,
                    timeout=10
                )
                if resp.status_code == 200:
                    sent += 1
                elif not self.fail_silently:
                    raise RuntimeError(f"Mailgun send failed ({resp.status_code}): {resp.text}")
            except Exception:
                if not self.fail_silently:
                    raise
        return sent