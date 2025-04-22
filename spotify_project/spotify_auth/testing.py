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

    access_token = "BQByXPhPJ8wZ-DsXP57Q1vzGk_s02DECSZHYhI3vTLzn9plYSFwa8i2bk7c00cuxCXRh4yAvucQc-IHDUWGVDb0ztMxQ_qpEH7HkqDL__BjH_7UZrgj87OXtrZOcFMNtMJQHcYvc79FjfYxIVvDGzJ19umD3rQAdIM2Gmk2L5WaewE1YqauylNUtw5Rj0jMOFn7jQqRpyVRtS3JgEcYoouXc_jUSIX9H-QvT2caSMmlcdJJMgEEPaLTdC_6icCuoUvJJLSrp"
    mock_request.session['spotify_access_token'] = access_token

    simplified_tracks, success = _fetch_all_spotify_tracks(mock_request)

    if success:
        print(json.dumps(simplified_tracks, indent=2))
    else:
        print("Failed to fetch tracks. Check your access token and network.")

if __name__ == "__main__":
    fetch_my_spotify_library()