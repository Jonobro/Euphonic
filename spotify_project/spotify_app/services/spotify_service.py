import threading
import time
import random
import requests
from pathlib import Path
from django.core.cache import cache
from ..utilities.logging import log_to_file, SPOTIFY_API_LOG_FILE, GENERAL_LOG_FILE, HTTP_REQUEST_LOG_FILE

def get_spotify_access_token():
    token_file_path = Path(__file__).parent.parent.parent / ".tokens"
    cache_key = 'spotify_access_token_data'

    try:
        current_mtime = token_file_path.stat().st_mtime
    except FileNotFoundError:
        log_to_file(GENERAL_LOG_FILE, f"Could not find the '.tokens' file. Searched directory: {token_file_path.parent}")
        return None

    cached_data = cache.get(cache_key)

    if cached_data and cached_data.get('mtime') == current_mtime:
        return cached_data.get('token')

    token = _get_token_line(token_file_path, 2)
    if token:
        cache.set(cache_key, {'token': token, 'mtime': current_mtime}, timeout=None)
    return token

def _get_token_line(tokens_file, line_number):
    log_to_file(GENERAL_LOG_FILE, f"_get_token_line called with file: {tokens_file}, line_number: {line_number}")
    try:
        with open(tokens_file, "r") as f:
            log_to_file(GENERAL_LOG_FILE, f"Successfully opened tokens file: {tokens_file}")
            for i, line in enumerate(f):
                if i == line_number:
                    token_preview = line.strip()[:10] + "..." if len(line.strip()) > 10 else line.strip()
                    log_to_file(GENERAL_LOG_FILE, f"Found token at line {line_number}: {token_preview}")
                    return line.strip()
        log_to_file(GENERAL_LOG_FILE, f"Line {line_number} not found in file {tokens_file} (file has fewer lines)")
    except Exception as e:
        log_to_file(GENERAL_LOG_FILE, f"Error reading tokens file {tokens_file}: {e}")
    log_to_file(GENERAL_LOG_FILE, f"_get_token_line returning None for file: {tokens_file}, line: {line_number}")
    return None

def _get_spotify_track_url_with_backoff(request, song_title, artist_name, chat_mode, max_retries=5):
    worker_id = threading.get_ident()
    
    NON_RETRYABLE_HTTP_CODES = {400, 401, 403, 404, 422}
    
    for attempt in range(max_retries):
        status, url, response_obj = _get_spotify_track_url(request, song_title, artist_name, chat_mode)
        
        if status in ['success', 'not_found', 'auth_error', 'app_error']:
            return status, url
        
        if status == 'error' and attempt < max_retries - 1:
            should_retry = True
            
            if response_obj and getattr(response_obj,"status_code",None) in NON_RETRYABLE_HTTP_CODES:
                should_retry = False
                log_to_file(SPOTIFY_API_LOG_FILE,f"Worker {worker_id}: Non-retryable HTTP {response_obj.status_code} for '{song_title}' by '{artist_name}'. Stopping retries.")
            if should_retry:
                delay = 2 ** attempt + random.uniform(0, 1)
                if response_obj is not None and getattr(response_obj,"status_code",None) == 429:
                    retry_after = int(response_obj.headers.get('Retry-After', delay))
                    delay = retry_after + random.uniform(0, 1)
                log_to_file(SPOTIFY_API_LOG_FILE,f"Worker {worker_id}: Retryable error for '{song_title}' by '{artist_name}'. Waiting {delay:.2f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            else:
                break
        else:
            break
    return status, url

def _get_spotify_track_url(request, song_title, artist_name, chat_mode):
    worker_id = threading.get_ident()

    if chat_mode == 'saved_songs':
        user_id = request.session.get('euphonic_intelligence_user_id')
        if not user_id:
            log_to_file(SPOTIFY_API_LOG_FILE,f"Worker {worker_id}: [APP_ERROR] User ID missing for saved songs search. Song: '{song_title}', Artist: '{artist_name}'")
            return 'app_error', None, None
        
        simplified_tracks = request.session.get('spotify_user_tracks')

        if simplified_tracks is None:
            log_to_file(SPOTIFY_API_LOG_FILE,f"Worker {worker_id}: [APP_ERROR] Cached library not found for user {user_id}. Song: '{song_title}', Artist: '{artist_name}'")
            return 'app_error', None, None

        search_title = song_title.strip().lower()
        search_artists = [a.strip().lower() for a in artist_name.split(',')]

        for track in simplified_tracks:
            track_title = track['name'].lower()
            track_artists = [a.strip().lower() for a in track['artists'].split(',')]
            
            if track_title == search_title and any(sa in track_artists for sa in search_artists):
                track_id = track['id']
                log_to_file(SPOTIFY_API_LOG_FILE, f"Worker {worker_id}: [CACHE_SEARCH_SUCCESS] Song: '{song_title}', Artist: '{artist_name}'. Track ID: {track_id}.")
                return 'success', f"https://open.spotify.com/track/{track_id}", None

        log_to_file(SPOTIFY_API_LOG_FILE, f"Worker {worker_id}: [CACHE_SEARCH_NO_RESULTS] Song: '{song_title}', Artist: '{artist_name}'.")
        return 'not_found', None, None

    access_token = get_spotify_access_token()
    if not access_token:
        log_to_file(SPOTIFY_API_LOG_FILE, f"Worker {worker_id}: [APP_ERROR] Access token missing. Song: '{song_title}', Artist: '{artist_name}'")
        return 'app_error', None, None

    search_url = 'https://api.spotify.com/v1/search'
    current_headers = {'Authorization': f'Bearer {access_token}'}
    
    if song_title.count('"') >= 2:
        song_title = song_title.replace('"', '')
    query_string = f'track:"{song_title}" artist:"{artist_name}"'
    params = {
        'q': query_string,
        'type': 'track',
        'limit': 1
    }
    
    prepared_request_attempt1 = requests.Request('GET', search_url, headers=current_headers, params=params).prepare()
    log_to_file(SPOTIFY_API_LOG_FILE, f"Worker {worker_id}: [SEARCH_ATTEMPT_1] Song: '{song_title}', Artist: '{artist_name}'. URL: {prepared_request_attempt1.url}")

    response = None
    try:
        log_to_file(HTTP_REQUEST_LOG_FILE, f"OUT ---> GET {prepared_request_attempt1.url}")
        response = requests.get(search_url, headers=current_headers, params=params, timeout=10)
        log_to_file(HTTP_REQUEST_LOG_FILE, f"IN <--- Response from {prepared_request_attempt1.url} | Status: {response.status_code}")

        log_to_file(SPOTIFY_API_LOG_FILE, f"Worker {worker_id}: [RAW_API_CALL_ATTEMPT_1] URL: {prepared_request_attempt1.url}, Headers: {prepared_request_attempt1.headers}, Response Status: {response.status_code}, Response Body:\n{response.text}")

        if response.status_code == 401:
            log_to_file(SPOTIFY_API_LOG_FILE, f"Worker {worker_id}: [AUTH_EXPIRED_ATTEMPT_1] Song: '{song_title}', Artist: '{artist_name}'.")
            return 'auth_error', None, response

        if response.status_code == 429:
            return 'error', None, response

        if 500 <= response.status_code < 600:
            return 'error', None, response

        if response.status_code in {400, 403, 404, 422}:
            log_to_file(SPOTIFY_API_LOG_FILE,f"Worker {worker_id}: [APP_ERROR_HTTP_{response.status_code}] Song: '{song_title}', Artist: '{artist_name}'.")
            return 'app_error', None, response

        response.raise_for_status()
        data = response.json()
        if data.get('tracks', {}).get('items'):
            track_id = data['tracks']['items'][0]['id']
            log_to_file(SPOTIFY_API_LOG_FILE, f"Worker {worker_id}: [SEARCH_SUCCESS] Song: '{song_title}', Artist: '{artist_name}'. Track ID: {track_id}.")
            return 'success', f"https://open.spotify.com/track/{track_id}", response
        else:
            log_to_file(SPOTIFY_API_LOG_FILE,f"Worker {worker_id}: [SEARCH_NO_RESULTS] Song: '{song_title}', Artist: '{artist_name}'. Query: {query_string}")
            return 'not_found', None, response

    except requests.exceptions.HTTPError as http_err:
        err_response = getattr(http_err, "response", None)
        status_code = getattr(err_response, "status_code", None)
        if status_code and 400 <= status_code < 500 and status_code not in {429}:
            err_text = err_response.text if err_response else 'No response text'
            log_to_file(SPOTIFY_API_LOG_FILE,f"Worker {worker_id}: [HTTP_ERROR_APP] Song: '{song_title}', Artist: '{artist_name}'. Error: {http_err}, Response: {err_text}")
            return 'app_error', None, err_response
        err_text = err_response.text if err_response else 'No response text'
        log_to_file(SPOTIFY_API_LOG_FILE,f"Worker {worker_id}: [HTTP_ERROR_RETRYABLE] Song: '{song_title}', Artist: '{artist_name}'. Error: {http_err}, Response: {err_text}")
        return 'error', None, err_response
    except requests.exceptions.RequestException as e:
        log_to_file(SPOTIFY_API_LOG_FILE, f"Worker {worker_id}: [REQUEST_EXCEPTION_RETRYABLE] Song: '{song_title}', Artist: '{artist_name}'. Error: {e}")
        return 'error', None, None
    except Exception as e_unexp:
        log_url = prepared_request_attempt1.url if 'prepared_request_attempt1' in locals() else "N/A"
        log_headers = prepared_request_attempt1.headers if 'prepared_request_attempt1' in locals() else current_headers
        response_text = response.text if response and hasattr(response, 'text') else "No response text."
        log_to_file(SPOTIFY_API_LOG_FILE, f"Worker {worker_id}: [UNEXPECTED_APP_ERROR] Song: '{song_title}', Artist: '{artist_name}'. Error: {e_unexp}. URL: {log_url}, Headers: {log_headers}, Response: {response_text}")
        return 'app_error', None, response
    
def _unfollow_playlist_async(playlist_id, access_token, session_key):
    try:
        # Wait 1 second before unfollowing to ensure Spotify propagation
        time.sleep(1)
        
        unfollow_url = f'https://api.spotify.com/v1/playlists/{playlist_id}/followers'
        headers = {'Authorization': f'Bearer {access_token}'}
        
        max_retries = 10
        NON_RETRYABLE_CODES = {400, 401, 403, 404, 422}
        
        for attempt in range(max_retries):
            try:
                log_to_file(HTTP_REQUEST_LOG_FILE, f"OUT ---> DELETE {unfollow_url} (attempt {attempt + 1}/{max_retries})")
                response = requests.delete(unfollow_url, headers=headers, timeout=10)
                log_to_file(HTTP_REQUEST_LOG_FILE, f"IN <--- Response from {unfollow_url} | Status: {response.status_code}")
                
                if response.status_code == 200:
                    log_to_file(SPOTIFY_API_LOG_FILE, f"Successfully unfollowed playlist {playlist_id} for session {session_key}")
                    return
                elif response.status_code in NON_RETRYABLE_CODES:
                    log_to_file(SPOTIFY_API_LOG_FILE, f"Non-retryable error {response.status_code} when unfollowing playlist {playlist_id} for session {session_key}. Response: {response.text}")
                    return
                elif response.status_code == 429:
                    retry_after = int(response.headers.get('Retry-After', (2 ** attempt) * 10))
                    delay = retry_after + random.uniform(0, 1)
                    log_to_file(SPOTIFY_API_LOG_FILE, f"Rate limited when unfollowing playlist {playlist_id}. Retrying in {delay:.2f}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(delay)
                    continue
                else:
                    if attempt < max_retries - 1:
                        delay = (2 ** attempt) * 10 + random.uniform(0, 1)
                        log_to_file(SPOTIFY_API_LOG_FILE, f"Error {response.status_code} when unfollowing playlist {playlist_id}. Retrying in {delay:.2f}s (attempt {attempt + 1}/{max_retries})")
                        time.sleep(delay)
                        continue
                    else:
                        log_to_file(SPOTIFY_API_LOG_FILE, f"Failed to unfollow playlist {playlist_id} after {max_retries} attempts. Final status: {response.status_code}, Response: {response.text}")
                        return
                        
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    delay = (2 ** attempt) * 10 + random.uniform(0, 1)
                    log_to_file(SPOTIFY_API_LOG_FILE, f"Request exception when unfollowing playlist {playlist_id}: {e}. Retrying in {delay:.2f}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(delay)
                    continue
                else:
                    log_to_file(SPOTIFY_API_LOG_FILE, f"Request failed when unfollowing playlist {playlist_id} after {max_retries} attempts: {e}")
                    return
        
        log_to_file(SPOTIFY_API_LOG_FILE, f"All retries exhausted when unfollowing playlist {playlist_id} for session {session_key}")
        
    except Exception as e:
        log_to_file(SPOTIFY_API_LOG_FILE, f"Unexpected error in _unfollow_playlist_async for playlist {playlist_id}: {e}")