from django.shortcuts import render, redirect
from django.urls import reverse
from django.views.decorators.csrf import csrf_protect
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.cache import never_cache
from django.core.cache import cache
from .utilities.logging import log_to_file, GENERAL_LOG_FILE, HTTP_REQUEST_LOG_FILE
from .utilities.rate_limit import rate_limit_scope
from .utilities.sse_helper import sse_same_origin_ok
from .utilities.session_utils import ensure_euphonic_intelligence_user_id
from .services import playlist_service
from .services import chat_service
from .services import streaming_service

@require_http_methods(["GET"])
def index(request):
    log_to_file(HTTP_REQUEST_LOG_FILE, f"IN <--- {request.method} {request.path} from session {request.session.session_key}")
    ensure_euphonic_intelligence_user_id(request)
    if request.GET.get('clear_storage') == 'true':
        chat_url = f"{reverse('chat')}?clear_storage=true"
        return redirect(chat_url)
    return redirect(reverse('chat'))

@csrf_protect
@require_http_methods(["POST"])
def reset_view(request):
    log_to_file(HTTP_REQUEST_LOG_FILE, f"IN <--- {request.method} {request.path} from session {request.session.session_key}")
    user_id = request.session.get('euphonic_intelligence_user_id')
    if user_id:
        cache.delete(f'analysis_in_progress_{user_id}')
    request.session.flush()
    request.session.save()
    reset_url = f"{reverse('index')}?clear_storage=true"
    return redirect(reset_url)

@csrf_protect
@require_http_methods(["GET"])
@never_cache
def chat_view(request):
    log_to_file(HTTP_REQUEST_LOG_FILE, f"IN <--- {request.method} {request.path} from session {request.session.session_key}")
    ensure_euphonic_intelligence_user_id(request)

    clear_storage = request.GET.get('clear_storage') == 'true'

    final_new_songs_chat_history = request.session.get('final_new_songs_chat_history', [])
    final_saved_songs_chat_history = request.session.get('final_saved_songs_chat_history', [])
    final_analysis_chat_history = request.session.get('final_analysis_chat_history', [])

    final_chat_history = [final_new_songs_chat_history, final_saved_songs_chat_history, final_analysis_chat_history]

    return render(request, 'spotify_app/chat.html', {
        'chat_history': final_chat_history,
        'clear_storage': clear_storage
    })

@csrf_protect
@require_http_methods(["POST"])
@never_cache
@rate_limit_scope('chat_initialize')
def initialize_chat_data_view(request):
    data, status = chat_service.initialize_chat_data_logic(request)
    return JsonResponse(data, status=status)

@csrf_protect
@require_http_methods(["POST"])
@never_cache
def reset_chat_history_api(request):
    data, status = chat_service.reset_chat_history_logic(request)
    return JsonResponse(data, status=status)

@csrf_protect
@require_http_methods(["POST"])
@never_cache
@rate_limit_scope('chat_message')
def chat_message_api(request):
    data, status = chat_service.chat_message_logic(request)
    return JsonResponse(data, status=status)

@csrf_protect
@require_http_methods(["GET"])
@never_cache
def get_submitted_playlists_api(request):
    data, status = playlist_service.get_submitted_playlists_logic(request)
    return JsonResponse(data, status=status)

@csrf_protect
@require_http_methods(["GET"])
@never_cache
def check_import_status_api(request):
    data, status = playlist_service.check_import_status_logic(request)
    return JsonResponse(data, status=status)

@csrf_protect
@require_http_methods(["POST"])
@never_cache
@rate_limit_scope('playlist_import')
def import_playlists_api(request):
    data, status = playlist_service.import_playlists_logic(request)
    return JsonResponse(data, status=status)

@csrf_protect
@require_http_methods(["POST"])
@never_cache
@rate_limit_scope('playlist_create')
def create_playlist_api(request):
    data, status = playlist_service.create_playlist_logic(request)
    return JsonResponse(data, status=status)

@csrf_protect
@require_http_methods(["POST"])
@never_cache
@rate_limit_scope('playlist_validate')
def validate_playlist_api(request):
    data, status = playlist_service.validate_playlist_logic(request)
    return JsonResponse(data, status=status)

@require_http_methods(["GET"])
@never_cache
def stream_initial_analysis(request):
    if not sse_same_origin_ok(request):
        origin = request.META.get('HTTP_ORIGIN')
        referer = request.META.get('HTTP_REFERER')
        log_to_file(GENERAL_LOG_FILE, f"Forbidden SSE request to stream_initial_analysis. Origin: {origin}, Referer: {referer}")
        return JsonResponse({'error': 'Forbidden'}, status=403)

    event_stream = streaming_service.initial_analysis_event_stream(request)
    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response

@require_http_methods(["GET"])
@never_cache
def stream_chat_response(request, task_id):
    if not sse_same_origin_ok(request):
        origin = request.META.get('HTTP_ORIGIN')
        referer = request.META.get('HTTP_REFERER')
        log_to_file(GENERAL_LOG_FILE, f"Forbidden SSE request to stream_chat_response. Origin: {origin}, Referer: {referer}, Task: {task_id}")
        return JsonResponse({'error': 'Forbidden'}, status=403)

    event_stream = streaming_service.chat_response_event_stream(request, task_id)
    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response