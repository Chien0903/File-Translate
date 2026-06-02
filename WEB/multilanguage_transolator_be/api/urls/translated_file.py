from django.urls import path
from api.views.translated_file import FileHistoryView, DeleteTranslatedFileView


urlpatterns = [
    path("history/", FileHistoryView.as_view(), name='file-history'),
    path("history/<int:pk>/", DeleteTranslatedFileView.as_view(), name="delete-translation"),
]
