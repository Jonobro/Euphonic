import base64
import hashlib
import secrets
import string
import requests
from urllib.parse import urlencode
import math

from django.shortcuts import render, redirect
from django.conf import settings
from django.urls import reverse
from django.views.decorators.csrf import csrf_protect
from django.http import HttpResponse

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

# Function to convert ms to mm:ss format
# Consistently rounds exact half seconds up to the nearest second to match Spotify's rounding
def format_duration(milliseconds):
    raw_seconds = milliseconds / 1000
    if raw_seconds % 1 == 0.5:
        seconds = int(raw_seconds + 0.5)
    else:
        seconds = round(raw_seconds)
    minutes = seconds // 60
    seconds = seconds % 60
    return f"{minutes}:{seconds:02d}"

# Display user's saved tracks from Spotify
def spotify_library(request):
    # Check if user is authenticated with Spotify and redirect to login screen if not
    access_token = request.session.get('spotify_access_token')
    if not access_token:
        return redirect(reverse('spotify_login'))
    
    # Call Spotify API to get user's saved tracks
    headers = {'Authorization': f'Bearer {access_token}'}
    
    # Get pagination parameters
    limit = 50  # Maximum allowed by Spotify
    offset = int(request.GET.get('offset', 0))
    
    # Make API request to get saved tracks
    response = requests.get(
        f'https://api.spotify.com/v1/me/tracks?limit={limit}&offset={offset}', 
        headers=headers
    )
    
    if response.status_code != 200:
        if response.status_code == 401:
            # Token expired, try to refresh automatically
            success = _refresh_token_helper(request)
            if success:
                # Try again with the new token
                access_token = request.session.get('spotify_access_token')
                headers = {'Authorization': f'Bearer {access_token}'}
                response = requests.get(
                    f'https://api.spotify.com/v1/me/tracks?limit={limit}&offset={offset}', 
                    headers=headers
                )
                if response.status_code == 200:
                    # Continue processing with the refreshed response
                    library_data = response.json()
                    # Process the data as normal
                    for item in library_data['items']:
                        item['track']['duration_formatted'] = format_duration(item['track']['duration_ms'])
                    
                    # Calculate pagination info
                    total_tracks = library_data['total']
                    has_next = (offset + limit) < total_tracks
                    has_prev = offset > 0
                    next_offset = offset + limit if has_next else None
                    prev_offset = max(0, offset - limit) if has_prev else None
                    
                    context = {
                        'tracks': library_data['items'],
                        'total': total_tracks,
                        'offset': offset,
                        'limit': limit,
                        'has_next': has_next,
                        'has_prev': has_prev,
                        'next_offset': next_offset,
                        'prev_offset': prev_offset
                    }
                    return render(request, 'spotify_auth/library.html', context)
            # If refresh failed or second attempt failed, redirect to login
            return redirect(reverse('spotify_login'))
        else:
            return render(request, 'spotify_auth/error.html', {
                'error': f'API call failed: {response.text}'
            })
    
    # Parse library data
    library_data = response.json()
    
    # Process track durations
    for item in library_data['items']:
        # Add formatted duration to each track
        item['track']['duration_formatted'] = format_duration(item['track']['duration_ms'])
    
    # Calculate pagination info
    total_tracks = library_data['total']
    has_next = (offset + limit) < total_tracks
    has_prev = offset > 0
    next_offset = offset + limit if has_next else None
    prev_offset = max(0, offset - limit) if has_prev else None
    
    # Prepare context
    context = {
        'tracks': library_data['items'],
        'total': total_tracks,
        'offset': offset,
        'limit': limit,
        'has_next': has_next,
        'has_prev': has_prev,
        'next_offset': next_offset,
        'prev_offset': prev_offset
    }
    
    # Render library page
    return render(request, 'spotify_auth/library.html', context)