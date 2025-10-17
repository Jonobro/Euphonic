import json
import uuid
import time
from django.core.cache import cache
from django.contrib.sessions.models import Session
from ..utilities.logging import log_to_file, GENERAL_LOG_FILE
from ..utilities.redis_utils import REDIS_CLIENT
from ..config.constants import (
    ANALYSIS_EVENT_CHANNEL_PREFIX,
    ANALYSIS_EVENT_TIMEOUT,
    CHAT_EVENT_CHANNEL_PREFIX,
    CHAT_EVENT_TIMEOUT
)

def initial_analysis_event_stream(request):
    session_key = request.session.session_key
    stream_id = str(uuid.uuid4())
    slot_key = f"sse:analysis:{session_key}"
    slot_ttl = ANALYSIS_EVENT_TIMEOUT + 60
    try:
        REDIS_CLIENT.set(slot_key, stream_id, ex=slot_ttl)
    except Exception as e:
        log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: failed to set slot key {slot_key}: {e}")

    def event_stream():
        try:
            final_history = request.session.get('final_analysis_chat_history')
            if final_history:
                log_to_file(GENERAL_LOG_FILE, "stream_initial_analysis: final_analysis_chat_history already present; sending session data.")
                yield f"data: {json.dumps({'response': final_history})}\n\n"
                return

            if not session_key:
                log_to_file(GENERAL_LOG_FILE, "stream_initial_analysis: No valid session_key found; aborting SSE stream.")
                yield f"event: stream_error\ndata: {json.dumps({'message': 'No valid session.'})}\n\n"
                return

            channel = f"{ANALYSIS_EVENT_CHANNEL_PREFIX}{session_key}"
            pubsub = REDIS_CLIENT.pubsub()
            try:
                pubsub.subscribe(channel)
                log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Subscribed to Redis channel '{channel}'.")
            except Exception as sub_err:
                log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Error subscribing to channel '{channel}': {sub_err}")
                yield f"event: stream_error\ndata: {json.dumps({'message': 'Subscription error.'})}\n\n"
                return

            start_time = time.time()
            last_keepalive = start_time
            last_ttl_refresh = start_time

            try:
                while True:
                    now = time.time()

                    try:
                        owner = REDIS_CLIENT.get(slot_key)
                        if isinstance(owner, bytes):
                            owner = owner.decode('utf-8')
                        if owner != stream_id:
                            log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: stream replaced for session {session_key}; exiting.")
                            return
                        if now - last_ttl_refresh >= 10:
                            REDIS_CLIENT.expire(slot_key, slot_ttl)
                            last_ttl_refresh = now
                    except Exception as e:
                        log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: slot check/refresh failed for {slot_key}: {e}")

                    if now - start_time > ANALYSIS_EVENT_TIMEOUT:
                        log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Timeout ({ANALYSIS_EVENT_TIMEOUT}s) waiting for analysis on channel '{channel}'.")
                        yield f"event: stream_error\ndata: {json.dumps({'message': 'Timeout waiting for musical analysis.'})}\n\n"
                        return

                    if now - last_keepalive >= 29:
                        yield ":\n\n"
                        last_keepalive = now

                    try:
                        message = pubsub.get_message(timeout=1.0)
                    except Exception as get_msg_err:
                        log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Error retrieving Redis message on '{channel}': {get_msg_err}")
                        continue

                    if not message or message.get('type') != 'message':
                        continue

                    payload = message['data']
                    if isinstance(payload, bytes):
                        payload = payload.decode('utf-8')

                    log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Received payload '{payload}' on '{channel}'.")

                    if payload == 'completed':
                        try:
                            session_obj = Session.objects.get(session_key=session_key)
                            session_data = session_obj.get_decoded()
                        except Session.DoesNotExist:
                            log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Session.DoesNotExist for key {session_key}; falling back to request.session.")
                            session_data = request.session
                        except Exception as sess_err:
                            log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Unexpected error loading session {session_key}: {sess_err}")
                            session_data = request.session

                        final_history = session_data.get('final_analysis_chat_history', [])

                        if not final_history:
                            log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: final_analysis_chat_history empty after 'completed'; retrying.")
                            max_retries = 5
                            for attempt in range(max_retries):
                                time.sleep(0.1)
                                try:
                                    session_obj_retry = Session.objects.get(session_key=session_key)
                                    session_data_retry = session_obj_retry.get_decoded()
                                    final_history = session_data_retry.get('final_analysis_chat_history', [])
                                    if final_history:
                                        log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: final_analysis_chat_history loaded on retry {attempt+1}.")
                                        break
                                except Exception as retry_err:
                                    log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: retry {attempt+1} error: {retry_err}")
                            if not final_history:
                                log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: final_analysis_chat_history still empty after retries; sending stream_error.")
                                yield f"event: stream_error\ndata: {json.dumps({'message': 'Musical analysis not available.'})}\n\n"
                                return
                        yield f"data: {json.dumps({'response': final_history})}\n\n"
                        return
                    elif payload == 'in_progress':
                        log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Received 'in_progress' status for session {session_key}.")
                        yield f"data: {json.dumps({'status': 'in_progress'})}\n\n"
                        continue
                    elif payload == 'failed':
                        log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Received 'failed' status for session {session_key}.")
                        yield f"event: stream_error\ndata: {json.dumps({'message': 'Musical analysis failed.'})}\n\n"
                        return
                    else:
                        log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Ignoring unknown payload '{payload}' on '{channel}'.")
            finally:
                try:
                    pubsub.close()
                    log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Closed Redis pubsub for channel '{channel}'.")
                except Exception as close_err:
                    log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: Error closing pubsub for channel '{channel}': {close_err}")
        except GeneratorExit:
            log_to_file(GENERAL_LOG_FILE, "stream_initial_analysis: GeneratorExit (client disconnected).")
            raise
        except Exception as e:
            log_to_file(GENERAL_LOG_FILE, f"SSE error in stream_initial_analysis outer handler: {e}")
            yield f"event: stream_error\ndata: {json.dumps({'message': 'Server error during streaming.'})}\n\n"
        finally:
            try:
                owner = REDIS_CLIENT.get(slot_key)
                if isinstance(owner, bytes):
                    owner = owner.decode('utf-8')
                if owner == stream_id:
                    REDIS_CLIENT.delete(slot_key)
            except Exception as e:
                log_to_file(GENERAL_LOG_FILE, f"stream_initial_analysis: failed to release slot {slot_key}: {e}")
    
    return event_stream

def chat_response_event_stream(request, task_id):
    stream_id = str(uuid.uuid4())
    slot_key = f"sse:chat:{task_id}"
    slot_ttl = CHAT_EVENT_TIMEOUT + 60
    try:
        REDIS_CLIENT.set(slot_key, stream_id, ex=slot_ttl)
    except Exception as e:
        log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] failed to set slot key {slot_key}: {e}")

    def event_stream():
        channel = f"{CHAT_EVENT_CHANNEL_PREFIX}{task_id}"
        log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Opening stream for task {task_id} on channel '{channel}'")
        pubsub = REDIS_CLIENT.pubsub()
        start_time = time.time()
        last_keepalive = start_time
        last_ttl_refresh = start_time
        try:
            try:
                pubsub.subscribe(channel)
                log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Subscribed to Redis channel '{channel}' (task {task_id})")
            except Exception as sub_err:
                log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Failed to subscribe to channel '{channel}' (task {task_id}): {sub_err}")
                yield f"event: stream_error\ndata: {json.dumps({'message': 'Subscription error.'})}\n\n"
                return

            try:
                pre_result = cache.get(task_id)
            except Exception as cache_err:
                log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Error reading initial cache for task {task_id}: {cache_err}")
                pre_result = None

            if pre_result:
                log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Found pre_result in cache for task {task_id} (keys: {list(pre_result.keys())})")
                if 'error' in pre_result:
                    yield f"event: stream_error\ndata: {json.dumps({'message': pre_result['error']})}\n\n"
                else:
                    try:
                        for k in [
                            'analysis_chat_history','final_analysis_chat_history',
                            'saved_songs_chat_history','final_saved_songs_chat_history',
                            'new_songs_chat_history','final_new_songs_chat_history',
                            'user_currently_revising_saved_songs_playlist',
                            'user_currently_revising_new_songs_playlist',
                            'saved_songs_context_window_exceeded',
                            'new_songs_context_window_exceeded',
                            'last_processed_playlist_saved_songs',
                            'last_processed_playlist_details_saved_songs',
                            'last_processed_playlist_new_songs',
                            'last_processed_playlist_details_new_songs',
                        ]:
                            if k in pre_result:
                                request.session[k] = pre_result[k]
                        request.session.save()
                        log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Session updated from pre_result for task {task_id}")
                    except Exception as sess_err:
                        log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Error saving session (pre_result) for task {task_id}: {sess_err}")
                    data = {
                        'response': pre_result.get('response'),
                        'chat_mode': pre_result.get('chat_mode')
                    }
                    yield f"data: {json.dumps(data)}\n\n"
                return

            while True:
                now = time.time()

                try:
                    owner = REDIS_CLIENT.get(slot_key)
                    if isinstance(owner, bytes):
                        owner = owner.decode('utf-8')
                    if owner != stream_id:
                        log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] stream replaced for task {task_id}; exiting.")
                        return
                    if now - last_ttl_refresh >= 10:
                        REDIS_CLIENT.expire(slot_key, slot_ttl)
                        last_ttl_refresh = now
                except Exception as e:
                    log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] slot check/refresh failed for {slot_key}: {e}")

                if now - start_time > CHAT_EVENT_TIMEOUT:
                    log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Timeout ({CHAT_EVENT_TIMEOUT}s) for task {task_id}")
                    err = {'message': 'Request timed out.'}
                    yield f"event: stream_error\ndata: {json.dumps(err)}\n\n"
                    return

                if now - last_keepalive >= 29:
                    yield ":\n\n"
                    last_keepalive = now

                try:
                    message = pubsub.get_message(timeout=1.0)
                except Exception as get_msg_err:
                    log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Error retrieving Redis message task {task_id}: {get_msg_err}")
                    continue

                if not message or message['type'] != 'message':
                    continue

                payload = message['data']
                if isinstance(payload, bytes):
                    payload = payload.decode('utf-8')

                if payload == 'completed':
                    try:
                        result = cache.get(task_id)
                        if not result:
                            time.sleep(0.1)
                            result = cache.get(task_id)
                    except Exception as cache_err:
                        log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Cache error retrieving result for task {task_id}: {cache_err}")
                        result = None

                    if not result:
                        err = {'message': 'Result missing.'}
                        log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Result missing after completion signal task {task_id}")
                        yield f"event: stream_error\ndata: {json.dumps(err)}\n\n"
                        return

                    try:
                        for k in [
                            'analysis_chat_history','final_analysis_chat_history',
                            'saved_songs_chat_history','final_saved_songs_chat_history',
                            'new_songs_chat_history','final_new_songs_chat_history',
                            'user_currently_revising_saved_songs_playlist',
                            'user_currently_revising_new_songs_playlist',
                            'saved_songs_context_window_exceeded',
                            'new_songs_context_window_exceeded',
                            'last_processed_playlist_saved_songs',
                            'last_processed_playlist_details_saved_songs',
                            'last_processed_playlist_new_songs',
                            'last_processed_playlist_details_new_songs',
                        ]:
                            if k in result:
                                request.session[k] = result[k]
                        request.session.save()
                        log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Session updated from completed result (task {task_id})")
                    except Exception as sess_err:
                        log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Error saving session (completed) task {task_id}: {sess_err}")

                    data = {
                        'response': result.get('response'),
                        'chat_mode': result.get('chat_mode')
                    }
                    yield f"data: {json.dumps(data)}\n\n"
                    return
                elif payload == 'failed':
                    try:
                        result = cache.get(task_id)
                    except Exception as cache_err:
                        log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Cache error retrieving failed result task {task_id}: {cache_err}")
                        result = None
                    if result and 'error' in result:
                        yield f"event: stream_error\ndata: {json.dumps({'message': result['error']})}\n\n"
                    else:
                        yield f"event: stream_error\ndata: {json.dumps({'message': 'Processing failed.'})}\n\n"
                    return
                else:
                    log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Unknown payload '{payload}' ignored (task {task_id})")

        except GeneratorExit:
            log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Client disconnected (GeneratorExit) task {task_id}")
            raise
        except Exception as e:
            log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Unhandled exception in stream for task {task_id}: {e}")
            err = {'message': 'A server error occurred during streaming.'}
            yield f"event: stream_error\ndata: {json.dumps(err)}\n\n"
        finally:
            try:
                pubsub.close()
                log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Closed pubsub for task {task_id}")
            except Exception as close_err:
                log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] Error closing pubsub task {task_id}: {close_err}")

            try:
                owner = REDIS_CLIENT.get(slot_key)
                if isinstance(owner, bytes):
                    owner = owner.decode('utf-8')
                if owner == stream_id:
                    REDIS_CLIENT.delete(slot_key)
            except Exception as e:
                log_to_file(GENERAL_LOG_FILE, f"[SSE CHAT] failed to release slot {slot_key}: {e}")
    
    return event_stream