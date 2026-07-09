from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..serializers.language import LanguageSerializer
from ..services.language_service import LanguageService


class LanguageListView(APIView):
    """GET /api/languages/ — 4 ngôn ngữ cố định của hệ thống (English, Japanese, Vietnamese, Chinese)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        languages = LanguageService.get_enabled_languages()
        return Response(LanguageSerializer(languages, many=True).data)
