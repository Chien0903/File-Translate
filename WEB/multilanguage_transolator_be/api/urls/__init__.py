from django.urls import include, path
from api.views.translate import TranslateFileView, TranslateTextView
from api.services.upload_to_s3 import upload_file_to_s3
from api.views.health import HealthCheckView
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
]