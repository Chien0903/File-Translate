from django.db import transaction
from ..models.company import Company
from ..models.language import Language
from ..models.company_language import CompanyLanguage
from ..models.audit_log import LanguageAuditLog


class CompanyLanguageService:

    @staticmethod
    def get_enabled_languages(company: Company):
        """Trả về queryset Language đang bật cho company."""
        return Language.objects.filter(
            company_languages__company=company,
            company_languages__is_enabled=True,
        ).order_by('sort_order')

    @staticmethod
    @transaction.atomic
    def enable_language(company: Company, language: Language, actor=None) -> CompanyLanguage:
        """Bật một ngôn ngữ cho company. Nếu chưa có CompanyLanguage thì tạo mới."""
        cl, created = CompanyLanguage.objects.get_or_create(
            company=company,
            language=language,
            defaults={'is_enabled': True},
        )
        if not created and not cl.is_enabled:
            cl.is_enabled = True
            cl.save(update_fields=['is_enabled'])

        LanguageAuditLog.objects.create(
            actor=actor,
            company=company,
            language=language,
            action='enable',
        )
        return cl

    @staticmethod
    @transaction.atomic
    def disable_language(company: Company, language: Language, actor=None) -> CompanyLanguage:
        """Tắt một ngôn ngữ. Không cho phép tắt ngôn ngữ đang là default."""
        cl = CompanyLanguage.objects.get(company=company, language=language)
        if cl.is_default:
            raise ValueError(
                f"Cannot disable '{language.code}' — it is the default language. "
                "Set another language as default first."
            )
        cl.is_enabled = False
        cl.save(update_fields=['is_enabled'])

        LanguageAuditLog.objects.create(
            actor=actor,
            company=company,
            language=language,
            action='disable',
        )
        return cl

    @staticmethod
    @transaction.atomic
    def set_default(company: Company, language: Language, actor=None) -> CompanyLanguage:
        """Đặt ngôn ngữ mặc định. Tự động bỏ default cũ trong cùng transaction."""
        cl = CompanyLanguage.objects.filter(
            company=company, language=language, is_enabled=True
        ).first()
        if not cl:
            raise ValueError(
                f"Language '{language.code}' is not enabled for company '{company.name}'. "
                "Enable it first before setting as default."
            )

        # Bỏ default cũ
        CompanyLanguage.objects.filter(
            company=company, is_default=True
        ).update(is_default=False)

        # Set default mới
        cl.is_default = True
        cl.save(update_fields=['is_default'])

        LanguageAuditLog.objects.create(
            actor=actor,
            company=company,
            language=language,
            action='set_default',
        )
        return cl

    @staticmethod
    def get_default_language(company: Company):
        """Trả về Language object là default của company, hoặc None."""
        cl = CompanyLanguage.objects.filter(
            company=company, is_default=True, is_enabled=True
        ).select_related('language').first()
        return cl.language if cl else None
