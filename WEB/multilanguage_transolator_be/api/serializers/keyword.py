from rest_framework import serializers
from api.models.keyword import KeywordSuggestion, PrivateKeyword


class PrivateKeywordSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    suggestion_status = serializers.SerializerMethodField()
    suggestion_id = serializers.SerializerMethodField()

    class Meta:
        model = PrivateKeyword
        fields = '__all__'
        read_only_fields = ['user', 'suggestion', 'created_at', 'updated_at']

    def get_suggestion_status(self, obj):
        if obj.suggestion_id is None:
            return None
        return obj.suggestion.status

    def get_suggestion_id(self, obj):
        return obj.suggestion_id


class KeywordSuggestionSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()

    def get_user_display(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name or obj.user.email
        return "Unknown"

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None

    def create(self, validated_data):
        request = self.context.get('request') if hasattr(self, 'context') else None
        if request and getattr(request, 'user', None) and request.user.is_authenticated:
            validated_data['user'] = request.user
        return KeywordSuggestion.objects.create(**validated_data)

    class Meta:
        model = KeywordSuggestion
        fields = '__all__'
        read_only_fields = ['status', 'approved_by', 'created_at', 'updated_at']
