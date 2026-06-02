from django.urls import path
from api.views.alb_auth import ALBAuthStatusView, ALBLogoutView, UserPermissionsView

urlpatterns = [
    path('alb/status/', ALBAuthStatusView.as_view(), name='alb_auth_status'),
    path('alb/logout/', ALBLogoutView.as_view(), name='alb_logout'),
    path('alb/permissions/', UserPermissionsView.as_view(), name='user_permissions'),
]
