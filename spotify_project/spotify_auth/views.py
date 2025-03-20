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


# ===== PKCE Utility Functions =====

def generate_code_verifier(length=64):
    """
    Generate a random string for PKCE code verifier.
    
    The code verifier is a high-entropy cryptographic random string
    with a length between 43 and 128 characters.
    """
    possible_chars = string.ascii_letters + string.digits + '-._~'
    code_verifier = ''.join(secrets.choice(possible_chars) for _ in range(length))
    return code_verifier


def generate_code_challenge(verifier):
    """
    Transform the code verifier using SHA256 algorithm to create the code challenge.
    """
    # SHA256 hash the verifier
    sha256_hash = hashlib.sha256(verifier.encode('utf-8')).digest()
    
    # Base64 URL encode the hash
    code_challenge = base64.urlsafe_b64encode(sha256_hash).decode('utf-8')
    
    # Remove padding characters
    code_challenge = code_challenge.replace('=', '')
    
    return code_challenge


# ===== Views =====

def index(request):
    """Home page with connection button."""
    return render(request, 'spotify_auth/index.html')


@csrf_protect
def spotify_login(request):
    """
    Start the Spotify OAuth flow with PKCE.
    Generates code verifier, code challenge, and state parameters.
    """
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
        'scope': 'user-read-private user-read-email',
        'code_challenge_method': 'S256',
        'code_challenge': code_challenge,
    }
    
    # Construct authorization URL
    auth_url = f"https://accounts.spotify.com/authorize?{urlencode(auth_params)}"
    
    # Redirect to Spotify authorization page
    return redirect(auth_url)


@csrf_protect
def spotify_callback(request):
    """
    Handle callback from Spotify.
    Exchange authorization code for access token using the PKCE flow.
    """
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
    request.session['spotify_token_expiry'] = token_info['expires_in']
    
    # Clean up session variables we no longer need
    if 'spotify_code_verifier' in request.session:
        del request.session['spotify_code_verifier']
    if 'spotify_auth_state' in request.session:
        del request.session['spotify_auth_state']
    
    # Redirect to profile page
    return redirect(reverse('spotify_profile'))


def spotify_profile(request):
    """
    Display user profile information from Spotify.
    Uses the access token to make API calls to Spotify.
    """
    # Check if user is authenticated with Spotify
    access_token = request.session.get('spotify_access_token')
    if not access_token:
        return redirect(reverse('spotify_login'))
    
    # Call Spotify API to get user profile
    headers = {'Authorization': f'Bearer {access_token}'}
    response = requests.get('https://api.spotify.com/v1/me', headers=headers)
    
    if response.status_code != 200:
        if response.status_code == 401:
            # Token expired, redirect to login
            if 'spotify_access_token' in request.session:
                del request.session['spotify_access_token']
            return redirect(reverse('spotify_login'))
        else:
            return render(request, 'spotify_auth/error.html', {
                'error': f'API call failed: {response.text}'
            })
    
    # Render profile page with user data
    user_data = response.json()
    return render(request, 'spotify_auth/profile.html', {'profile': user_data})


def refresh_token(request):
    """
    Refresh the access token using the refresh token.
    """
    refresh_token = request.session.get('spotify_refresh_token')
    if not refresh_token:
        return redirect(reverse('spotify_login'))
    
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
        return redirect(reverse('spotify_login'))
    
    token_info = response.json()
    
    # Update tokens in session
    request.session['spotify_access_token'] = token_info['access_token']
    request.session['spotify_token_expiry'] = token_info['expires_in']
    if 'refresh_token' in token_info:
        request.session['spotify_refresh_token'] = token_info['refresh_token']
    
    # Redirect back to profile
    return redirect(reverse('spotify_profile'))