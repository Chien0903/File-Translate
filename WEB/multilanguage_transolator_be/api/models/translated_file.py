from django.db import models
from .user import CustomUser

class Folder(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='folders')
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'name')

    def __str__(self):
        return f"{self.user_id}/{self.name}"


class TranslatedFile(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='translated_files')
    original_file_url = models.URLField(max_length=1000, default="")
    original_file_name = models.CharField(max_length=255, default="")
    translated_file_url = models.URLField(max_length=1000, default="")
    original_language = models.CharField(max_length=10, default="")
    target_language = models.CharField(max_length=10)
    file_type = models.CharField(max_length=10, default="unknown")
    folder_name = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.original_file_name} - {self.original_language} to {self.target_language}" 