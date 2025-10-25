# Euphonic Intelligence
Django-based web application that integrates with Spotify and Google's Gemini to create custom playlists for users.

## Features
- Allows users to create custom Spotify playlists using natural language prompts.
- Users can create playlists of new songs, create playlists using only their existing libraries, and generate a detailed analysis of their musical preferences.
- Application allows for playlist import (using Spotify share links) and playlist export (opening the generated playlist in Spotify).
- The app is mobile-friendly and supports use as a PWA on both Android and iOS. App has been thoroughly tested on all major browsers.

## Stack
- **Backend**: Django (Python)
- **Web Server**: Nginx
- **Database**: SQLite (session data)
- **Containerization**: Docker & Docker Compose
- **Application Server**: Gunicorn
- **SSL Certificates**: Certbot

## Core Modules
- analysis_service.py: Handles generation of musical analysis for the user. This occurs in the background as soon as the user imports any of their music.
- chat_service.py: Logic for conversation initialization & management. Handling of incoming user messages and AI responses.
- gemini_service.py: Dedicated Gemini module that handles Gemini client generation and selection, Gemini errors, request rate limiting, and request cost calculation.
- playlist_service.py: Playlist validation, import, and creation logic.
- spotify_service.py: Spotify API helpers.
- streaming_service.py: SSE management for chat messages and musical analysis.

## Utilities
- Helper modules for logging, Redis caching, session management, SSE streaming, rate limiting, and Gemini grounding.

## Testing
- tests.py: Comprehensive test suite that evaluates LLM performance with respect to playlist generation and user queries. Uses Bayesian hyperparameter optimization to fine-tune Gemini model parameters.