import hashlib
from django.db import models
from django.utils import timezone


class RefreshToken(models.Model):
    user = models.ForeignKey(
        'api.CustomUser',
        on_delete=models.CASCADE,
        related_name='refresh_tokens',
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @classmethod
    def hash_token(cls, token: str) -> str:
        return hashlib.sha256(token.encode('utf-8')).hexdigest()

    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @classmethod
    def purge_expired(cls) -> int:
        deleted, _ = cls.objects.filter(expires_at__lt=timezone.now()).delete()
        return deleted
