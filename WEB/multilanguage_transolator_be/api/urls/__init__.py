from django.urls import include, path
from api.views.translate import TranslateFileView, TranslateTextView
from api.services.upload_to_s3 import upload_file_to_s3
from api.views.health import HealthCheckView
from api.views.language import (
    CompanyLanguageListView,
    EnableLanguageView,
    DisableLanguageView,
    SetDefaultLanguageView,
    LanguageAuditLogView,
    AddLanguageView,
)

urlpatterns = [
    # Core functionality
    path('keywords/', include('api.urls.keyword')),
    path('user/', include('api.urls.user')),
    path('upload-to-s3/', upload_file_to_s3, name='upload_file_to_s3'),
    path('translate/', TranslateFileView.as_view(), name='translate_file'),
    path('translate-text/', TranslateTextView.as_view(), name='translate_text'),
    path('convert/', include('api.urls.convert')),
    path('translated-file/', include('api.urls.translated_file')),
    path('notifications/', include('api.urls.notification')),
    path('check-pdf-editable/', include('api.urls.pdf_validation')),

    # Admin statistics
    path('', include('api.urls.keyword_stats')),

    # JWT authentication
    path('auth/', include('api.urls.alb_auth')),
    path('health/', HealthCheckView.as_view(), name='health_check'),

    # Language management — system level
    path('languages/', include('api.urls.language')),

    # Language management — company level
    path('companies/<int:company_id>/languages/', CompanyLanguageListView.as_view(), name='company_language_list'),
    path('companies/<int:company_id>/languages/audit-log/', LanguageAuditLogView.as_view(), name='language_audit_log'),
    path('companies/<int:company_id>/languages/add/', AddLanguageView.as_view(), name='language_add'),
    path('companies/<int:company_id>/languages/<int:lang_id>/enable/', EnableLanguageView.as_view(), name='language_enable'),
    path('companies/<int:company_id>/languages/<int:lang_id>/disable/', DisableLanguageView.as_view(), name='language_disable'),
    path('companies/<int:company_id>/languages/<int:lang_id>/set-default/', SetDefaultLanguageView.as_view(), name='language_set_default'),
]
