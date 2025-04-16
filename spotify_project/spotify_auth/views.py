import base64
import hashlib
import secrets
import string
import requests
from urllib.parse import urlencode

from django.shortcuts import render, redirect
from django.conf import settings
from django.urls import reverse
from django.views.decorators.csrf import csrf_protect
from django.http import HttpResponse
from google import genai

# ===== PKCE Utility Functions =====

# Generate a random string for PKCE code verifier
def generate_code_verifier(length=64):
    possible_chars = string.ascii_letters + string.digits + '-._~'
    code_verifier = ''.join(secrets.choice(possible_chars) for _ in range(length))
    return code_verifier

# Transform the code verifier using SHA256 algorithm to create the code challenge
def generate_code_challenge(verifier):
    # SHA256 hash the verifier
    sha256_hash = hashlib.sha256(verifier.encode('utf-8')).digest()
    # Base64 URL encode the hash
    code_challenge = base64.urlsafe_b64encode(sha256_hash).decode('utf-8')
    # Remove padding characters
    code_challenge = code_challenge.replace('=', '')
    return code_challenge

# ===== Views =====

# View function for the index page
def index(request):
    return render(request, 'spotify_auth/index.html')

# Begin OAuth flow with PKCE
@csrf_protect
def spotify_login(request):
    # Generate code verifier and store in session
    code_verifier = generate_code_verifier(64)
    request.session['spotify_code_verifier'] = code_verifier
    
    # Generate code challenge from verifier
    code_challenge = generate_code_challenge(code_verifier)
    
    # Generate state parameter for CSRF protection
    state = secrets.token_urlsafe(16)
    request.session['spotify_auth_state'] = state
    
    # Define authorization parameters
    auth_params = {
        'client_id': settings.SPOTIFY_CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': settings.SPOTIFY_REDIRECT_URI,
        'state': state,
        'scope': 'user-read-private user-read-email user-library-read',
        'code_challenge_method': 'S256',
        'code_challenge': code_challenge,
    }
    
    # Construct authorization URL
    auth_url = f"https://accounts.spotify.com/authorize?{urlencode(auth_params)}"
    
    # Redirect to Spotify authorization page
    return redirect(auth_url)

# Handle callback from Spotify
@csrf_protect
def spotify_callback(request):
    # Get code from query parameters
    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')
    
    # Check for errors in the callback
    if error:
        return render(request, 'spotify_auth/error.html', {'error': error})
    
    # Verify state parameter to prevent CSRF attacks
    stored_state = request.session.get('spotify_auth_state')
    if not state or state != stored_state:
        return render(request, 'spotify_auth/error.html', {
            'error': 'State verification failed. Possible CSRF attack.'
        })
    
    # Get the code verifier from session
    code_verifier = request.session.get('spotify_code_verifier')
    if not code_verifier:
        return render(request, 'spotify_auth/error.html', {
            'error': 'Code verifier not found in session.'
        })
    
    # Exchange authorization code for access token
    token_url = 'https://accounts.spotify.com/api/token'
    
    token_data = {
        'client_id': settings.SPOTIFY_CLIENT_ID,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': settings.SPOTIFY_REDIRECT_URI,
        'code_verifier': code_verifier,
    }
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    }
    
    # Make request to Spotify token endpoint
    response = requests.post(token_url, data=token_data, headers=headers)
    
    if response.status_code != 200:
        return render(request, 'spotify_auth/error.html', {
            'error': f'Token exchange failed: {response.text}'
        })
    
    # Parse token response
    token_info = response.json()
    
    # Store tokens securely in session
    request.session['spotify_access_token'] = token_info['access_token']
    if 'refresh_token' in token_info:
        request.session['spotify_refresh_token'] = token_info['refresh_token']

    # Delete session variables that are no longer needed for increased security
    if 'spotify_code_verifier' in request.session:
        del request.session['spotify_code_verifier']
    if 'spotify_auth_state' in request.session:
        del request.session['spotify_auth_state']
    
    # Redirect to profile page
    return redirect(reverse('spotify_profile'))

# Display user profile information from Spotify using access token
def spotify_profile(request):
    # Check if user is authenticated with Spotify
    access_token = request.session.get('spotify_access_token')
    if not access_token:
        return redirect(reverse('spotify_login'))
    
    # Call Spotify API to get user profile
    headers = {'Authorization': f'Bearer {access_token}'}
    response = requests.get('https://api.spotify.com/v1/me', headers=headers)
    
    if response.status_code != 200:
        if response.status_code == 401:
            # Token expired, try to refresh automatically
            success = _refresh_token_helper(request)
            if success:
                # Try again with the new token
                access_token = request.session.get('spotify_access_token')
                headers = {'Authorization': f'Bearer {access_token}'}
                response = requests.get('https://api.spotify.com/v1/me', headers=headers)
                if response.status_code == 200:
                    user_data = response.json()
                    return render(request, 'spotify_auth/profile.html', {'profile': user_data})
            # If refresh failed or second attempt failed, redirect to login
            return redirect(reverse('spotify_login'))
        else:
            return render(request, 'spotify_auth/error.html', {
                'error': f'API call failed: {response.text}'
            })
    
    # Render profile page with user data
    user_data = response.json()
    return render(request, 'spotify_auth/profile.html', {'profile': user_data})

def logout_view(request):
    # Flush the entire session to remove all data, including Spotify tokens
    request.session.flush() 
    # Redirect to the index page after logout
    return redirect(reverse('index'))

# Helper function to refresh access token when it expires
# Returns boolean variable to indicate success or failure
def _refresh_token_helper(request):
    refresh_token = request.session.get('spotify_refresh_token')
    if not refresh_token:
        return False
    
    token_url = 'https://accounts.spotify.com/api/token'
    
    payload = {
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
        'client_id': settings.SPOTIFY_CLIENT_ID,
    }
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    }
    
    response = requests.post(token_url, data=payload, headers=headers)
    
    if response.status_code != 200:
        if 'spotify_refresh_token' in request.session:
            del request.session['spotify_refresh_token']
        return False
    
    token_info = response.json()
    
    # Update tokens in session
    request.session['spotify_access_token'] = token_info['access_token']
    if 'refresh_token' in token_info:
        request.session['spotify_refresh_token'] = token_info['refresh_token']
    return True

# Helper function to gather all tracks
def _fetch_all_spotify_tracks(request):
    simplified_tracks = []
    limit = 50
    offset = 0
    total = None

    while True:
        access_token = request.session.get('spotify_access_token')
        if not access_token:
            print("Access token missing during library fetch.")
            return None, False

        headers = {'Authorization': f'Bearer {access_token}'}
        try:
            response = requests.get(
                f'https://api.spotify.com/v1/me/tracks?limit={limit}&offset={offset}',
                headers=headers,
                timeout=15
            )

            if response.status_code == 401:
                print("Token expired during library fetch, attempting refresh...")
                refresh_success = _refresh_token_helper(request)
                if not refresh_success:
                    print("Token refresh failed during library fetch.")
                    return None, False
                continue

            response.raise_for_status()

            data = response.json()
            items = data.get('items', [])
            if not items:
                 break

            for item in items:
                track = item.get('track')
                if track:
                    track_name = track.get('name')
                    artist_names = [artist.get('name') for artist in track.get('artists', [])]
                    simplified_tracks.append({
                        'name': track_name,
                        'artists': ', '.join(artist_names)
                    })

            if total is None:
                total = data.get('total')

            if total is not None and len(simplified_tracks) >= total:
                break

            offset += len(items)

            # Handles excessively large libraries
            if offset > 20000:
                print(f"Exiting due to excessively large library")
                break

        except requests.exceptions.RequestException as e:
            print(f"Error fetching Spotify tracks: {e}")
            return None, False

    return simplified_tracks, True

def spotify_library(request):
    if not request.session.get('spotify_access_token'):
        return redirect(reverse('spotify_login'))

    simplified_tracks_list, fetch_success = _fetch_all_spotify_tracks(request)

    if not fetch_success:
        if not request.session.get('spotify_access_token'):
             return redirect(reverse('spotify_login'))
        else:
             return render(request, 'spotify_auth/error.html', {
                 'error': 'Could not retrieve your Spotify library at this time. Please try again later.'
             })
    
    full_library_string = "Your Spotify Library is empty or could not be fully retrieved."
    total_tracks = 0
    if simplified_tracks_list:
        song_strings = [f"{track['name']} by {track['artists']}" for track in simplified_tracks_list]
        full_library_string = "\n".join(song_strings)
        total_tracks = len(simplified_tracks_list)

    context = {
        'library_string': full_library_string,
        'total': total_tracks,
    }

    return render(request, 'spotify_auth/library.html', context)

def gemini_test_view(request):
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Explain how AI works in a few words"
        )
        result_text = response.text

    except Exception as e:
        result_text = f"An error occurred: {str(e)}"

    return render(request, 'spotify_auth/gemini_test.html', {'gemini_result': result_text})