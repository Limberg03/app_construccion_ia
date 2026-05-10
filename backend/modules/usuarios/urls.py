from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import AuthViewSet, LoginView

urlpatterns = [
    path("register/", AuthViewSet.as_view({"post": "register"}), name="register"),
    path("me/", AuthViewSet.as_view({"get": "me"}), name="me"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
