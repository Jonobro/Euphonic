from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('login/', views.spotify_login, name='spotify_login'),
    path('callback/', views.spotify_callback, name='spotify_callback'),
    path('logout/', views.logout_view, name='logout'),
    path('pre_chat/', views.pre_chat_view, name='pre_chat'),
    path('chat/saved/', views.saved_songs_chat_view, name='saved_songs_chat'),
    path('chat/new/', views.new_song_chat_view, name='new_song_chat'),
    path('chat/analyze/', views.musical_analysis_view, name='musical_analysis'),
    path('initialize_chat_data/', views.initialize_chat_data_view, name='initialize_chat_data'),
    path('stream_initial_analysis/<str:task_id>/', views.stream_initial_analysis, name='stream_initial_analysis'),
    path('chat_message_api/', views.chat_message_api, name='chat_message_api'),
    path('stream_chat_response/<str:task_id>/', views.stream_chat_response, name='stream_chat_response'),
    path('create_playlist_api/', views.create_playlist_api, name='create_playlist_api'),
    path('reset_chat_history_api/', views.reset_chat_history_api, name='reset_chat_history_api'),
]