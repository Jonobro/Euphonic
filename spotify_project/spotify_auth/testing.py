import os
import sys
import django
from unittest.mock import Mock
import json

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spotify_project.settings')

try:
    django.setup()
except RuntimeError as e:
    if "already configured" not in str(e):
        raise

from django.conf import settings
from spotify_auth.views import _fetch_all_spotify_tracks, query_musicbrainz_recordings, _refresh_token_helper

class DummySession(dict):
    def __init__(self):
        super().__init__()
        self.modified = False

def fetch_my_spotify_library():
    mock_request = Mock()
    mock_request.session = DummySession()

    access_token = "BQDl6DrUkjU48OxGmgKeS7T8Ig2yOn5aYxxXc_ULJBub1DW4GFOFjstHgABCkYwJZa0oGxYQVAZqKhE-xWOaOtt69PvOq1yLX1GiqudKoat4aShaxcZq-xp89JCktfC0KkLKupPPnHmkcjOfxiRa3H4GyekdFKrwD7u0mb1Ada30Hx23woSIefLTaOgNhkNRw-i1dRRREEr_tCttNyf7-j4V1jROfzcPE6X542P5Z15y2KQ3buoM708uKqJq5DKq_EthldAH"
    mock_request.session['spotify_access_token'] = access_token

    simplified_tracks, success = _fetch_all_spotify_tracks(mock_request)

    if success:
        print(json.dumps(simplified_tracks, indent=2))
    else:
        print("Failed to fetch tracks. Check your access token and network.")

if __name__ == "__main__":
    fetch_my_spotify_library()