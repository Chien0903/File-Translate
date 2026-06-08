from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

class HealthCheckView(APIView):
    """
    Health check endpoint for ALB
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        return JsonResponse({
            'status': 'healthy',
            'service': 'multilanguage-translator-api'
        })
