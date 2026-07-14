from django.urls import path
from api.views.translated_file import (
    FileHistoryView,
    DeleteTranslatedFileView,
    MoveToFolderView,
    FolderListCreateView,
)


urlpatterns = [
    path("history/", FileHistoryView.as_view(), name='file-history'),
    path("history/move/", MoveToFolderView.as_view(), name="move-file-folder"),
    path("history/<int:pk>/", DeleteTranslatedFileView.as_view(), name="delete-translation"),
    path("folders/", FolderListCreateView.as_view(), name="folder-list-create"),
]
