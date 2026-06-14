from django.db import models
from .company import Company
from .language import Language


class CompanyLanguage(models.Model):
    """Ngôn ngữ mà từng company kích hoạt."""
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='company_languages'
    )
    language = models.ForeignKey(
        Language, on_delete=models.CASCADE, related_name='company_languages'
    )
    is_enabled = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    enabled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('company', 'language')]
        # Partial unique index (UNIQUE WHERE is_default = TRUE) được thêm thủ công
        # trong migration 0032 vì Django không hỗ trợ native syntax này.

    def __str__(self):
        default_mark = " [default]" if self.is_default else ""
        return f"{self.company.name} — {self.language.code}{default_mark}"
