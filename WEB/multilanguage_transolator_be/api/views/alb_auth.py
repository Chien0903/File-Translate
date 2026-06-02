import logging
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from ..serializers.user import CustomUserSerializer

logger = logging.getLogger(__name__)

class ALBAuthStatusView(APIView):
    """
    Check ALB authentication status
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """
        Check if user is authenticated via ALB or DevAuthentication
        """
        try:
            # Check if request has ALB authentication
            is_alb_authenticated = getattr(request, 'alb_authenticated', False)
            
            # Trong DEBUG mode, DevAuthentication sẽ tự động login user
            # Không cần check alb_authenticated flag
            is_dev_authenticated = settings.DEBUG and request.user.is_authenticated
            
            if (is_alb_authenticated or is_dev_authenticated) and request.user.is_authenticated:
                user_data = CustomUserSerializer(request.user).data
                
                # Xác định provider
                provider = 'dev_auth' if (settings.DEBUG and not is_alb_authenticated) else 'alb_cognito'
                
                return Response({
                    'authenticated': True,
                    'provider': provider,
                    'user': user_data,
                    'permissions': {
                        'is_admin': request.user.role == 'Admin',
                        'is_translator': request.user.role == 'Library Keeper',
                        'is_user': request.user.role == 'User',
                    }
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'authenticated': False,
                    'provider': None
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"ALB auth status check error: {str(e)}")
            return Response({
                'error': 'Failed to check authentication status'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ALBLogoutView(APIView):
    """
    Handle ALB/Cognito logout
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        """
        Generate proper logout URL for ALB/Cognito
        """
        try:
            # Cognito logout URL - lấy từ settings (đã config từ .env)
            cognito_domain = getattr(settings, 'COGNITO_DOMAIN_URL')
            app_client_id = getattr(settings, 'COGNITO_APP_CLIENT_ID')
            
            # Determine logout URI based on current domain
            origin = request.META.get('HTTP_ORIGIN', request.build_absolute_uri('/'))
            
            # Map domains to logout URIs - get from settings
            production_url = getattr(settings, 'COGNITO_REDIRECT_URI', 'https://aitranslate.torayhk.com')
            dev_url = getattr(settings, 'FRONTEND_URL', 'https://fhk-dev.quant-nexus.com')
            
            domain_mapping = {
                production_url.rstrip('/'): f"{production_url}/",
                dev_url.rstrip('/'): f"{dev_url}/",
                'http://localhost:5173': 'http://localhost:5173/',
            }
            
            logout_uri = domain_mapping.get(origin.rstrip('/'), f"{origin}/")
            
            # Construct Cognito logout URL
            logout_url = (
                f"{cognito_domain}/logout?"
                f"client_id={app_client_id}&"
                f"logout_uri={logout_uri}"
            )
            
            return Response({
                'logout_url': logout_url,
                'logout_uri': logout_uri
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"ALB logout error: {str(e)}")
            return Response({
                'error': 'Failed to generate logout URL'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserPermissionsView(APIView):
    """
    Get user permissions based on Cognito groups
    """
    def get(self, request):
        """
        Return user permissions for RBAC
        """
        try:
            if not request.user.is_authenticated:
                return Response({
                    'error': 'User not authenticated'
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            permissions = {
                'user_id': request.user.id,
                'email': request.user.email,
                'role': request.user.role,
                'permissions': {
                    'is_admin': request.user.role == 'Admin',
                    'is_translator': request.user.role == 'Library Keeper',
                    'is_user': request.user.role == 'User',
                    'can_manage_users': request.user.role == 'Admin',
                    'can_manage_keywords': request.user.role in ['Admin', 'Library Keeper'],
                    'can_translate': True,  # All authenticated users can translate
                    'can_view_history': True,  # All users can view their history
                }
            }
            
            return Response(permissions, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"User permissions error: {str(e)}")
            return Response({
                'error': 'Failed to get user permissions'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
