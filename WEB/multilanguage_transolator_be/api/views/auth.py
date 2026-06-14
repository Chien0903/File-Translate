from rest_framework import generics
from ..serializers.user import RegisterSerializer
from ..models.user import CustomUser
from rest_framework.permissions import AllowAny


class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
