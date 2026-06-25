from django.db import models
from .user import CustomUser


class PrivateKeyword(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='private_keywords')
    translations = models.JSONField(default=dict, blank=True)
    note = models.TextField(blank=True, null=True)
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


class KeywordQueue(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    translations = models.JSONField(default=dict, blank=True)
    is_processed = models.BooleanField(default=False, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Queue item by {self.user} - {self.created_at}"


class KeywordSuggestion(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    translations = models.JSONField(default=dict, blank=True)
    suggestion_count = models.IntegerField(default=1)
    frequency_percentage = models.FloatField(default=0.0)
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
