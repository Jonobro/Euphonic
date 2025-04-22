import os
import sys
import django
from unittest.mock import Mock
import json
import requests

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

    access_token = "BQCT0f8jHnPmMYaORAtlrQw7Z8mWiFFgyPohrhVF87Mbq9S7zzD4LpHYeKNzrcl49WydwHMuPJ0NEP0SG8SlH9eL38rxr9npT0O2zZwagS-IM3Hcrp1-r9YO4-WR5EkLU2pOBCYwUwL4MDlrKndNC_RYslTWBG3c8WScy2Cx8Pj4gipiJL0_2_eD-RqSwibxOlNO9UjBI_Ue0YF11oaxJbn73v7XwENQrdVLhcnPmKd7Ov0E"
    mock_request.session['spotify_access_token'] = access_token

    simplified_tracks, success = _fetch_all_spotify_tracks(mock_request)

    if success:
        print(json.dumps(simplified_tracks, indent=2))
    else:
        print("Failed to fetch tracks. Check your access token and network.")

if __name__ == "__main__":
    fetch_my_spotify_library()