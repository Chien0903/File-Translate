from django.db import models
from .user import CustomUser


class PrivateKeyword(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='private_keywords')
    translations = models.JSONField(default=dict, blank=True)
    suggestion = models.ForeignKey(
        'KeywordSuggestion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='private_keywords',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        t = self.translations or {}
        return f"PrivateKeyword by {self.user} | {t.get('en') or t.get('ja') or '—'}"


class KeywordSuggestion(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    translations = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('approved', 'Approved'),
            ('rejected', 'Rejected'),
        ],
        default='pending',
        db_index=True,
    )
    approved_by = models.ForeignKey(
        CustomUser, null=True, blank=True,
        related_name='approved_suggestions', on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        pass

    def __str__(self):
        t = self.translations or {}
        return f"Suggestion by {self.user} | {self.status} | {t.get('en') or t.get('ja') or '—'}"


class LibraryQueueSettings(models.Model):
    min_suggesters_for_queue = models.PositiveIntegerField(default=2)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Library queue settings"
        verbose_name_plural = "Library queue settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
