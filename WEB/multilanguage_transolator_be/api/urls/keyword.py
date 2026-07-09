from django.urls import path
from ..views.keyword import (
    ApproveSuggestionView,
    DeleteSuggestionView,
    UpdateKeywordView,
    ReviewSuggestionView,
    UploadKeywordsToGCSView,
    GCSUploadStatusView,
    KeywordSuggestionListCreateView,
    SuggestionQueueSettingsView,
    SuggestionQueueListView,
    PrivateKeywordListCreateView,
    PrivateKeywordDetailView,
    PrivateKeywordSuggestView,
)

urlpatterns = [
    # Main Keywords API - accessed via /api/keywords/
    path('suggestions/', KeywordSuggestionListCreateView.as_view(), name='keyword-list-create'),
    path('suggestions/queue/', SuggestionQueueListView.as_view(), name='suggestion-queue-list'),
    path('suggestions/queue-settings/', SuggestionQueueSettingsView.as_view(), name='suggestion-queue-settings'),
    path('suggestions/<int:pk>/review/', ReviewSuggestionView.as_view(), name='keyword-review'),
    path('suggestions/<int:pk>/approve/', ApproveSuggestionView.as_view(), name='keyword-approve'),
    path('<int:pk>/update/', UpdateKeywordView.as_view(), name='keyword-update'),
    path('<int:pk>/delete/', DeleteSuggestionView.as_view(), name='keyword-delete'),

    # GCS Upload endpoints - accessed via /api/keywords/
    path('upload-to-gcs/', UploadKeywordsToGCSView.as_view(), name='upload-to-gcs'),
    path('gcs-status/', GCSUploadStatusView.as_view(), name='get-gcs-status'),

    # Private Library endpoints - accessed via /api/keywords/private/
    path('private/', PrivateKeywordListCreateView.as_view(), name='private-keyword-list-create'),
    path('private/suggest/', PrivateKeywordSuggestView.as_view(), name='private-keyword-suggest'),
    path('private/<int:pk>/', PrivateKeywordDetailView.as_view(), name='private-keyword-detail'),
]
