from rest_framework import generics
from ..serializers.user import CustomUserSerializer
from rest_framework.permissions import IsAuthenticated
from ..models import CustomUser
from rest_framework.response import Response
from rest_framework.views import APIView

class UserListView(generics.ListAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [IsAuthenticated]

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get (self, request):
        serializer = CustomUserSerializer(request.user)
        return Response(serializer.data, status=200)
    
class UpdateProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        user = request.user
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        email = request.data.get('email')
        # NOTE: 'role' is NOT accepted here to prevent privilege escalation.
        # Only admins can change roles via UpdateUserRoleView.
        if email:
            user.email = email
        if first_name:
            user.first_name = first_name
        if last_name:
            user.last_name = last_name
        user.save()
        return Response({"detail": "Profile updated successfully."}, status=200)

class GetUserDetailView(APIView):
    permission_classes = [IsAuthenticated]  # Yêu cầu user phải đăng nhập

    def get(self, request, user_id):
        try:
            user = CustomUser.objects.get(id=user_id)
        except CustomUser.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)

        data = {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
        }

        return Response(data, status=200)

class UpdateUserRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        # Kiểm tra xem người gọi API có phải là Admin không
        if not request.user.role == "Admin":
            return Response({"detail": "You do not have permission to change roles."}, status=403)

        try:
            user = CustomUser.objects.get(id=user_id)
        except CustomUser.DoesNotExist:
            return Response({"detail": "Người dùng không tồn tại."}, status=404)

        new_role = request.data.get("role")
        if new_role not in ["Admin", "User", "Library Keeper"]:
            return Response({"detail": "Invalid role."}, status=400)

        user.role = new_role
        user.save()

        return Response({"detail": "Role updated successfully."}, status=200)

class DeleteUserView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):
        if request.user.role != "Admin":
            return Response({"detail": "You do not have permission to delete users."}, status=403)

        try:
            user = CustomUser.objects.get(id=user_id)
        except CustomUser.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)

        user.delete()
        return Response({"detail": "User deleted successfully."}, status=200)
    