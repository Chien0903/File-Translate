from django.db import models
from .user import CustomUser


class PrivateKeyword(models.Model):
    """Thư viện keyword riêng của từng user"""
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='private_keywords')
    japanese = models.TextField(blank=True, null=True)
    english = models.TextField(blank=True, null=True)
    vietnamese = models.TextField(blank=True, null=True)
    chinese_traditional = models.TextField(blank=True, null=True)
    chinese_simplified = models.TextField(blank=True, null=True)
    thai = models.TextField(blank=True, null=True)
    bengali = models.TextField(blank=True, null=True)
    hindi = models.TextField(blank=True, null=True)
    indonesian = models.TextField(blank=True, null=True)
    oriya = models.TextField(blank=True, null=True)

    note = models.TextField(blank=True, null=True, help_text="Ghi chú cá nhân")

    # Liên kết đến suggestion được tạo từ keyword này (null nếu chưa suggest)
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
        return f"PrivateKeyword by {self.user} | {self.english or self.japanese or '—'}"


class KeywordQueue(models.Model):
    """Hàng chờ cho việc đề xuất từ khóa từ người dùng"""
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    japanese = models.TextField(blank=True, null=True)
    english = models.TextField(blank=True, null=True)
    vietnamese = models.TextField(blank=True, null=True)
    chinese_traditional = models.TextField(blank=True, null=True)
    chinese_simplified = models.TextField(blank=True, null=True)
    thai = models.TextField(blank=True, null=True)
    bengali = models.TextField(blank=True, null=True)
    hindi = models.TextField(blank=True, null=True)
    indonesian = models.TextField(blank=True, null=True)
    oriya = models.TextField(blank=True, null=True)
    
    # Trạng thái xử lý
    is_processed = models.BooleanField(default=False, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Queue item by {self.user} - {self.created_at}"

class KeywordSuggestion(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    japanese = models.TextField(blank=True, null=True)
    english = models.TextField(blank=True, null=True)
    vietnamese = models.TextField(blank=True, null=True)
    chinese_traditional = models.TextField(blank=True, null=True)
    chinese_simplified = models.TextField(blank=True, null=True)
    thai = models.TextField(blank=True, null=True)
    bengali = models.TextField(blank=True, null=True)
    hindi = models.TextField(blank=True, null=True)
    indonesian = models.TextField(blank=True, null=True)
    oriya = models.TextField(blank=True, null=True)

    # Thêm các trường thống kê (map đúng cột DB hiện tại)
    suggestion_count = models.IntegerField(
        default=1,
        help_text="Số lần từ này được đề xuất",
    )
    frequency_percentage = models.FloatField(default=0.0, help_text="Tỷ lệ phần trăm xuất hiện")
 
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
    approved_by = models.ForeignKey(CustomUser, null=True, blank=True, related_name='approved_suggestions', on_delete=models.SET_NULL)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Sẽ thêm unique constraint sau khi đã xử lý dữ liệu trùng lặp
        pass

    def __str__(self):
        return f"Suggestion by {self.user} | {self.status} | Count: {self.suggestion_count}"


class LibraryQueueSettings(models.Model):
    """Singleton (pk=1): ngưỡng số user đề xuất cùng nội dung để vào hàng chờ duyệt."""
    min_suggesters_for_queue = models.PositiveIntegerField(
        default=2,
        help_text="Tối thiểu số người đề xuất khác nhau (cùng một cặp ngôn ngữ) để từ vào hàng chờ",
    )
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