from django.contrib import admin
from django.urls import path, include
from api.views.auth import RegisterView

urlpatterns = [
    path("user/register/", RegisterView.as_view(), name="register"),
]
