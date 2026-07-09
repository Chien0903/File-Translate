from rest_framework import serializers
from ..models.language import Language


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ['id', 'code', 'name', 'native_name', 'flag_emoji', 'sort_order']
