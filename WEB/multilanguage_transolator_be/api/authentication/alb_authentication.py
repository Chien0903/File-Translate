# api/authentication/alb_authentication.py
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth import get_user_model
import jwt, logging

AUDIT = logging.getLogger("auth_audit")

class ALBAuthentication(BaseAuthentication):
    """
    Allow only when:
      - Email can be extracted from OIDC token/Access token (ALB/Cognito)
      - Email matches an EXISTING and active user in DB
    Do not create/update users here. All user info comes from DB.
    """

    def authenticate(self, request):
        oidc_jwt     = request.META.get("HTTP_X_AMZN_OIDC_DATA")
        access_token = request.META.get("HTTP_X_AMZN_OIDC_ACCESSTOKEN")

        # Không có dấu vết SSO => nhường authenticator khác (VD JWT)
        if not (oidc_jwt or access_token):
            return None

        # Ưu tiên lấy email từ OIDC (thường có scope email)
        email = None
        for tok in (oidc_jwt, access_token):
            if not tok:
                continue
            try:
                claims = jwt.decode(tok, options={"verify_signature": False, "verify_aud": False})
                email = (claims.get("email") or claims.get("username") or "").strip().lower()
                if email:
                    break
            except Exception as e:
                AUDIT.debug("Decode token failed: %s", e)

        if not email:
            AUDIT.info("No email claim present -> deny")
            raise AuthenticationFailed("Email claim not found in SSO session")

        User = get_user_model()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            # Do not auto-create users. Deny if not provisioned in DB.
            raise AuthenticationFailed("Account is not provisioned in the system")

        # Đánh dấu đã qua SSO, nhưng KHÔNG ghi gì vào DB
        request.alb_authenticated = True
        request.alb_claims = {"email": email}
        AUDIT.info("ALB SSO PASS (matched DB) | email=%s | path=%s", email, request.path)
        return (user, None)

    def authenticate_header(self, request):
        return "Bearer"
