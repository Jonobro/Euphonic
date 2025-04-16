from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('login/', views.spotify_login, name='spotify_login'),
    path('callback/', views.spotify_callback, name='spotify_callback'),
    path('profile/', views.spotify_profile, name='spotify_profile'),
    path('library/', views.spotify_library, name='spotify_library'),
    path('logout/', views.logout_view, name='logout'),
]