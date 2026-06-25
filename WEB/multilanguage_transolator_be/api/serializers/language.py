from rest_framework import serializers
from ..models.language import Language
from ..models.company_language import CompanyLanguage
from ..models.audit_log import LanguageAuditLog


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ['id', 'code', 'name', 'native_name', 'flag_emoji', 'is_active', 'sort_order']


class CompanyLanguageSerializer(serializers.ModelSerializer):
    language = LanguageSerializer(read_only=True)

    class Meta:
        model = CompanyLanguage
        fields = ['id', 'language', 'is_enabled', 'is_default', 'enabled_at']


class LanguageAuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()
    language_code = serializers.SerializerMethodField()

    class Meta:
        model = LanguageAuditLog
        fields = ['id', 'actor_email', 'language_code', 'action', 'note', 'created_at']

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor else 'system'

    def get_language_code(self, obj):
        return obj.language.code if obj.language else None
