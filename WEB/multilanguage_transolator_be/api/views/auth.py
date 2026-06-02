from django.shortcuts import render
from rest_framework import generics
from ..serializers.user import RegisterSerializer, CustomUserSerializer
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import IsAuthenticated, AllowAny
from ..models.user import CustomUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status


class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        
        user = self.user
        
        data["id"] = user.id
        data["email"] = user.email
        data["first_name"] = user.first_name
        data["last_name"] = user.last_name
        data["role"] = user.role
        data["is_active"] = user.is_active
        data["is_staff"] = user.is_staff
        data["is_superuser"] = user.is_superuser

        return data
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
            return response
        except Exception as e:
            return Response(
                {"detail": "Invalid email or password. Please check your credentials."},
                status=status.HTTP_401_UNAUTHORIZED
            )
    
"""
Change password endpoint removed for SSO-only mode (passwords managed by IdP).
"""

"""
Forgot/Reset password endpoints removed for SSO-only mode (ALB + Cognito manages passwords).
"""