from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from ..models.language import Language
from ..models.company import Company
from ..models.company_language import CompanyLanguage
from ..models.audit_log import LanguageAuditLog
from ..serializers.language import (
    LanguageSerializer,
    CompanyLanguageSerializer,
    LanguageAuditLogSerializer,
)
from ..services.company_language_service import CompanyLanguageService


class LanguageListView(APIView):
    """GET /api/languages/ — tất cả ngôn ngữ active trong hệ thống."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        languages = Language.objects.filter(is_active=True)
        return Response(LanguageSerializer(languages, many=True).data)


class MyCompanyLanguagesView(APIView):
    """GET /api/languages/my-company/ — ngôn ngữ enabled của company user đang đăng nhập."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = request.user.company
        if not company:
            languages = Language.objects.filter(is_active=True).order_by('sort_order')
        else:
            languages = CompanyLanguageService.get_enabled_languages(company)
        return Response(LanguageSerializer(languages, many=True).data)


class CompanyLanguageListView(APIView):
    """GET /api/companies/{company_id}/languages/ — tất cả ngôn ngữ (cả on/off) của 1 company."""
    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        company = get_object_or_404(Company, pk=company_id, is_active=True)
        company_languages = CompanyLanguage.objects.filter(
            company=company
        ).select_related('language').order_by('language__sort_order')
        return Response(CompanyLanguageSerializer(company_languages, many=True).data)


class EnableLanguageView(APIView):
    """POST /api/companies/{company_id}/languages/{lang_id}/enable/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, company_id, lang_id):
        if request.user.role not in ('Admin',):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        company = get_object_or_404(Company, pk=company_id)
        language = get_object_or_404(Language, pk=lang_id)
        cl = CompanyLanguageService.enable_language(company, language, actor=request.user)
        return Response(CompanyLanguageSerializer(cl).data, status=status.HTTP_200_OK)


class DisableLanguageView(APIView):
    """POST /api/companies/{company_id}/languages/{lang_id}/disable/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, company_id, lang_id):
        if request.user.role not in ('Admin',):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        company = get_object_or_404(Company, pk=company_id)
        language = get_object_or_404(Language, pk=lang_id)
        try:
            cl = CompanyLanguageService.disable_language(company, language, actor=request.user)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CompanyLanguageSerializer(cl).data, status=status.HTTP_200_OK)


class SetDefaultLanguageView(APIView):
    """POST /api/companies/{company_id}/languages/{lang_id}/set-default/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, company_id, lang_id):
        if request.user.role not in ('Admin',):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        company = get_object_or_404(Company, pk=company_id)
        language = get_object_or_404(Language, pk=lang_id)
        try:
            cl = CompanyLanguageService.set_default(company, language, actor=request.user)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CompanyLanguageSerializer(cl).data, status=status.HTTP_200_OK)


class AddLanguageView(APIView):
    """POST /api/companies/{company_id}/languages/add/ — tạo Language nếu chưa có, rồi enable cho company."""
    permission_classes = [IsAuthenticated]

    def post(self, request, company_id):
        if request.user.role not in ('Admin',):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        company = get_object_or_404(Company, pk=company_id)

        code = request.data.get('code', '').strip()
        name = request.data.get('name', '').strip()
        native_name = request.data.get('native_name', '').strip()
        flag_emoji = request.data.get('flag_emoji', '').strip()

        if not code or not name:
            return Response({'detail': 'code and name are required.'}, status=status.HTTP_400_BAD_REQUEST)

        language, _ = Language.objects.get_or_create(
            code=code,
            defaults={'name': name, 'native_name': native_name, 'flag_emoji': flag_emoji, 'is_active': True},
        )
        cl = CompanyLanguageService.enable_language(company, language, actor=request.user)
        return Response(CompanyLanguageSerializer(cl).data, status=status.HTTP_200_OK)


class LanguageAuditLogView(APIView):
    """GET /api/companies/{company_id}/languages/audit-log/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, company_id):
        if request.user.role not in ('Admin',):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        company = get_object_or_404(Company, pk=company_id)
        logs = LanguageAuditLog.objects.filter(
            company=company
        ).select_related('actor', 'language').order_by('-created_at')[:50]
        return Response(LanguageAuditLogSerializer(logs, many=True).data)
