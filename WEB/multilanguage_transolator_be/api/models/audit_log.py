from django.db import models
from .user import CustomUser
from .company import Company
from .language import Language


class LanguageAuditLog(models.Model):
    ACTION_CHOICES = [
        ('enable', 'Enable Language'),
        ('disable', 'Disable Language'),
        ('set_default', 'Set Default Language'),
        ('add_language', 'Add Language to System'),
    ]

    actor = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, related_name='audit_logs'
    )
    company = models.ForeignKey(
        Company, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs'
    )
    language = models.ForeignKey(
        Language, on_delete=models.SET_NULL, null=True, related_name='audit_logs'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {self.actor} — {self.action} — {self.language}"
