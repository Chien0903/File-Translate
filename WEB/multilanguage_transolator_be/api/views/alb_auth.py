import logging
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import authenticate, get_user_model
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken as JWTRefreshToken

from ..models.refresh_token import RefreshToken
from ..serializers.user import CustomUserSerializer

logger = logging.getLogger(__name__)
User = get_user_model()


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password') or ''

        if not email or not password:
            return Response(
                {'detail': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, username=email, password=password)
        if user is None:
            return Response(
                {'detail': 'Invalid email or password.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {'detail': 'Account is disabled.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = JWTRefreshToken.for_user(user)
        refresh_str = str(refresh)
        access_str = str(refresh.access_token)

        RefreshToken.objects.create(
            user=user,
            token_hash=RefreshToken.hash_token(refresh_str),
            expires_at=timezone.now() + settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'],
        )
        RefreshToken.purge_expired()

        logger.info("LOGIN | user=%s | role=%s", user.email, user.role)
        return Response({
            'access': access_str,
            'refresh': refresh_str,
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
            },
        }, status=status.HTTP_200_OK)


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_str = (request.data.get('refresh') or '').strip()
        if not refresh_str:
            return Response(
                {'detail': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_hash = RefreshToken.hash_token(refresh_str)
        try:
            db_token = RefreshToken.objects.select_related('user').get(token_hash=token_hash)
        except RefreshToken.DoesNotExist:
            return Response(
                {'detail': 'Invalid or revoked refresh token.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if db_token.is_expired():
            db_token.delete()
            return Response(
                {'detail': 'Refresh token has expired. Please log in again.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = db_token.user
        if not user.is_active:
            return Response(
                {'detail': 'Account is disabled.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Rotate: delete old, issue new
        db_token.delete()

        new_refresh = JWTRefreshToken.for_user(user)
        new_refresh_str = str(new_refresh)
        new_access_str = str(new_refresh.access_token)

        RefreshToken.objects.create(
            user=user,
            token_hash=RefreshToken.hash_token(new_refresh_str),
            expires_at=timezone.now() + settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'],
        )

        return Response({
            'access': new_access_str,
            'refresh': new_refresh_str,
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_str = (request.data.get('refresh') or '').strip()
        if refresh_str:
            token_hash = RefreshToken.hash_token(refresh_str)
            RefreshToken.objects.filter(user=request.user, token_hash=token_hash).delete()
        logger.info("LOGOUT | user=%s", request.user.email)
        return Response({'detail': 'Logged out successfully.'}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(CustomUserSerializer(request.user).data, status=status.HTTP_200_OK)
