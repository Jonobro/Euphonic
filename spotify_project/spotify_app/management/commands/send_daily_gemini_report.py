from __future__ import annotations
from datetime import timedelta
from typing import List, Tuple
from django.conf import settings
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.utils import timezone
from scripts.metrics_store import get_metrics_for_date
from zoneinfo import ZoneInfo
class Command(BaseCommand):
    help = "Send a daily email report of Gemini usage and Spotify activity."
    
    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            help="ISO date (YYYY-MM-DD) to report on. Defaults to 'yesterday' in server local time.",
        )
        parser.add_argument(
            "--print",
            action="store_true",
            help="Print the report to stdout instead of sending email.",
        )

    def handle(self, *args, **options):
        if options.get("date"):
            day_str = options["date"]
        else:
            pst = ZoneInfo("America/Los_Angeles")
            day_str = (timezone.now().astimezone(pst).date() - timedelta(days=1)).isoformat()

        m = get_metrics_for_date(day_str)
        unique_users = m.get("unique_users", [])
        unique_users_count = len(unique_users)

        subject = f"Daily Euphonic Intelligence Report - {day_str}"
        body_lines = [
            f"Date: {day_str}",
            "",
            f"Total Gemini Requests: {m.get('gemini_requests', 0)}",
            f"Total Token Cost: ${m.get('token_cost', 0.0):,.2f}",
            f"Total Spotify Playlists Created: {m.get('playlists_created', 0)}",
            f"Total Unique Users: {unique_users_count}",
        ]
        body = "\n".join(body_lines)

        if options.get("print"):
            self.stdout.write(body)
            return

        to_email = getattr(settings, "DEFAULT_TO_EMAIL", None)
        recipient = str(to_email).strip() if to_email else ""
        if not recipient:
            self.stderr.write("No DEFAULT_TO_EMAIL configured in settings.")
            self.stdout.write("\n" + body)
            return

        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)
        sender = str(from_email).strip() if from_email else ""
        if not sender:
            self.stderr.write("No DEFAULT_FROM_EMAIL configured in settings.")
            self.stdout.write("\n" + body)
            return

        sent = send_mail(
            subject=subject,
            message=body,
            from_email=sender,
            recipient_list=[recipient],
            fail_silently=False,
        )

        self.stdout.write(
            f"Report for {day_str} sent to 1 recipient. send_mail returned: {sent}"
        )