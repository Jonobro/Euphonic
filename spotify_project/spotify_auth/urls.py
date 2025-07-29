from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('reset/', views.reset_view, name='reset'),
    path('chat/saved/', views.saved_songs_chat_view, name='saved_songs_chat'),
    path('chat/new/', views.new_song_chat_view, name='new_song_chat'),
    path('chat/analyze/', views.musical_analysis_view, name='musical_analysis'),
    path('initialize_chat_data/', views.initialize_chat_data_view, name='initialize_chat_data'),
    path('stream_initial_analysis/<str:task_id>/', views.stream_initial_analysis, name='stream_initial_analysis'),
    path('chat_message_api/', views.chat_message_api, name='chat_message_api'),
    path('stream_chat_response/<str:task_id>/', views.stream_chat_response, name='stream_chat_response'),
    path('create_playlist_api/', views.create_playlist_api, name='create_playlist_api'),
    path('reset_chat_history_api/', views.reset_chat_history_api, name='reset_chat_history_api'),
    path('import_playlists/', views.import_playlists_api, name='import_playlists'),
    path('check_import_status/', views.check_import_status, name='check_import_status'),
]