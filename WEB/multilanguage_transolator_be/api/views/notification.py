from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from ..models.notification import Notification
from ..serializers.notification import NotificationSerializer
from django.contrib.auth import get_user_model

class NotificationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user).order_by('-created_at')
        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = NotificationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MarkNotificationAsReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(id=notification_id, user=request.user)
            notification.read = True
            notification.save()
            return Response({"message": "Notification marked as read"})
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)

class CreateNotificationForAllUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Tạo notification cho tất cả users
        Body: {
            "title": "string",
            "message": "string", 
            "details": boolean (optional),
            "keyword_details": array (optional)
        }
        """
        # Chỉ cho phép admin hoặc library keeper
        if not (request.user.is_staff or request.user.role in ['Admin', 'Library Keeper']):
            return Response(
                {"error": "Permission denied"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        title = request.data.get('title')
        message = request.data.get('message')
        details = request.data.get('details', False)
        keyword_details = request.data.get('keyword_details', None)
        
        if not title or not message:
            return Response(
                {"error": "Title and message are required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        User = get_user_model()
        users = User.objects.all()
        
        created_notifications = []
        
        for user in users:
            notification = Notification.objects.create(
                user=user,
                title=title,
                message=message,
                details=details,
                keyword_details=keyword_details
            )
            created_notifications.append(notification.id)
        
        return Response({
            "message": f"Created {len(created_notifications)} notifications",
            "notification_ids": created_notifications
        }, status=status.HTTP_201_CREATED) 