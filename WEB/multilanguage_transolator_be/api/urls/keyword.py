from django.urls import path
from ..views.keyword import (
    ApproveSuggestionView,
    DeleteSuggestionView,
    UpdateKeywordView,
    ReviewSuggestionView,
    upload_keywords_to_gcs,
    get_gcs_upload_status,
    keyword_suggestions_list_create,
    process_keyword_queue_api,
    get_queue_status,
    suggestion_queue_settings,
    suggestion_queue_list,
    duplicate_alerts_list,
    duplicate_alert_dismiss,
    PrivateKeywordListCreateView,
    PrivateKeywordDetailView,
    PrivateKeywordSuggestView,
)

urlpatterns = [
    # Main Keywords API - accessed via /api/keywords/
    path('suggestions/', keyword_suggestions_list_create, name='keyword-list-create'),
    path('suggestions/queue/', suggestion_queue_list, name='suggestion-queue-list'),
    path('suggestions/queue-settings/', suggestion_queue_settings, name='suggestion-queue-settings'),
    path('suggestions/<int:pk>/review/', ReviewSuggestionView.as_view(), name='keyword-review'),
    path('suggestions/<int:pk>/approve/', ApproveSuggestionView.as_view(), name='keyword-approve'),
    path('<int:pk>/update/', UpdateKeywordView.as_view(), name='keyword-update'),
    path('<int:pk>/delete/', DeleteSuggestionView.as_view(), name='keyword-delete'),

    # Duplicate alerts - accessed via /api/keywords/
    path('duplicate-alerts/', duplicate_alerts_list, name='duplicate-alerts-list'),
    path('duplicate-alerts/<int:pk>/dismiss/', duplicate_alert_dismiss, name='duplicate-alert-dismiss'),
    
    # Queue Management endpoints - accessed via /api/keywords/
    path('queue/status/', get_queue_status, name='queue-status'),
    path('queue/process/', process_keyword_queue_api, name='process-queue'),
    
    # GCS Upload endpoints - accessed via /api/keywords/
    path('upload-to-gcs/', upload_keywords_to_gcs, name='upload-to-gcs'),
    path('gcs-status/', get_gcs_upload_status, name='get-gcs-status'),

    # Private Library endpoints - accessed via /api/keywords/private/
    path('private/', PrivateKeywordListCreateView.as_view(), name='private-keyword-list-create'),
    path('private/suggest/', PrivateKeywordSuggestView.as_view(), name='private-keyword-suggest'),
    path('private/<int:pk>/', PrivateKeywordDetailView.as_view(), name='private-keyword-detail'),
]
