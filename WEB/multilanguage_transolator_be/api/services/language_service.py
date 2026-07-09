from ..models.language import Language


class LanguageService:

    @staticmethod
    def get_enabled_languages():
        """Trả về queryset toàn bộ ngôn ngữ trong hệ thống (cố định 4 ngôn ngữ)."""
        return Language.objects.all().order_by('sort_order')
