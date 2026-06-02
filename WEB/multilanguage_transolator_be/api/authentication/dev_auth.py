import os
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication

logger = logging.getLogger("auth_audit")

class DevAuthentication(BaseAuthentication):
    """
    Dev only:
    - Khi DEBUG=True, auto-login vào tài khoản admin
    - Ưu tiên: DEV_LOGIN_EMAIL env var > role=admin > is_superuser > user đầu tiên
    - Tránh lỗi khi không có ALB/Cognito ở local
    """
    _logged_user = None  # cache email đã log, tránh in lặp mỗi request

    def authenticate(self, request):
        if not settings.DEBUG:
            return None

        User = get_user_model()
        user = None

        # 1. Ưu tiên dùng email từ environment variable
        dev_email = os.getenv("DEV_LOGIN_EMAIL")

        if dev_email:
            user = User.objects.filter(email=dev_email, is_active=True).first()
            if not user:
                logger.warning(f"[DevAuthentication] User '{dev_email}' not found in DB!")

        # 2. Tìm user có role=Admin
        if not user:
            user = User.objects.filter(role='Admin', is_active=True).first()

        # 3. Tìm superuser
        if not user:
            user = User.objects.filter(is_superuser=True, is_active=True).first()

        # 4. Fallback: user đầu tiên
        if not user:
            user = User.objects.filter(is_active=True).first()

        if not user:
            return None

        # Chỉ log một lần khi user thay đổi (tránh spam mỗi request)
        if DevAuthentication._logged_user != user.email:
            DevAuthentication._logged_user = user.email
            logger.info(f"[DevAuthentication] Auto-login as {user.email} (role={getattr(user, 'role', 'N/A')})")

        return (user, None)
