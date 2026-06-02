from django.contrib import admin
from django.urls import path, include
from api.views.user import UserListView, UserProfileView, UpdateProfileView, UpdateUserRoleView, GetUserDetailView, DeleteUserView
from api.views.auth import RegisterView


urlpatterns = [
    path("", UserListView.as_view(), name="user_list"),
    path("profile/", UserProfileView.as_view(), name="user_profile"),
    path("update-profile/", UpdateProfileView.as_view(), name="update_profile"),
    path("<int:user_id>/", GetUserDetailView.as_view(), name="get-user-detail"),
    path("<int:user_id>/update-role/", UpdateUserRoleView.as_view(), name="update-user-role"),
    path("<int:user_id>/delete/", DeleteUserView.as_view(), name="delete-user"),
    path("register/", RegisterView.as_view(), name="register"),
]
