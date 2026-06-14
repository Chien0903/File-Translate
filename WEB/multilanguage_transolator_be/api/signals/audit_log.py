from django.db.models.signals import post_save
from django.dispatch import receiver
from ..models.company_language import CompanyLanguage
from ..models.audit_log import LanguageAuditLog


@receiver(post_save, sender=CompanyLanguage)
def log_default_change(sender, instance, created, **kwargs):
    """
    Backup log khi is_default thay đổi qua ORM trực tiếp (ngoài service layer).
    Service layer đã ghi log chủ động — signal chỉ catch các trường hợp còn lại.
    """
    if not created and instance.is_default:
        from django.utils import timezone
        from datetime import timedelta
        already_logged = LanguageAuditLog.objects.filter(
            company=instance.company,
            language=instance.language,
            action='set_default',
            created_at__gte=timezone.now() - timedelta(seconds=1),
        ).exists()
        if not already_logged:
            LanguageAuditLog.objects.create(
                actor=None,
                company=instance.company,
                language=instance.language,
                action='set_default',
                note='Auto-logged by signal',
            )
