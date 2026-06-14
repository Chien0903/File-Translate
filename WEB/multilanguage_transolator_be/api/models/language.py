from django.db import models


class Language(models.Model):
    """Bảng master ngôn ngữ — thay thế dict LANGUAGES hardcode."""
    code = models.CharField(max_length=10, unique=True)       # 'vi', 'ja', 'zh-CN'
    name = models.CharField(max_length=100)                   # 'Vietnamese', 'Japanese'
    native_name = models.CharField(max_length=100, blank=True)  # 'Tiếng Việt', '日本語'
    flag_emoji = models.CharField(max_length=10, blank=True)  # '🇻🇳', '🇯🇵'
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.code} — {self.name}"
