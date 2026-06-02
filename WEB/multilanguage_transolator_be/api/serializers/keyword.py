from rest_framework import serializers
from django.core.exceptions import ValidationError
from api.models.keyword import KeywordSuggestion, KeywordQueue, PrivateKeyword

class KeywordQueueSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    
    class Meta:
        model = KeywordQueue
        fields = '__all__'
        read_only_fields = ['user', 'is_processed', 'processed_at', 'created_at']
    
    def get_user_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip()
        return "Unknown User"

class PrivateKeywordSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    # Trạng thái suggestion: null | 'pending' | 'approved' | 'rejected'
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
    def create(self, validated_data):
        # Gán user nếu có trong context request
        request = self.context.get('request') if hasattr(self, 'context') else None
        if request and getattr(request, 'user', None) and request.user.is_authenticated:
            validated_data['user'] = request.user
        # Đảm bảo các trường NOT NULL có giá trị mặc định
        if validated_data.get('suggestion_count') is None:
            validated_data['suggestion_count'] = 1
        if validated_data.get('frequency_percentage') is None:
            validated_data['frequency_percentage'] = 0.0
        return KeywordSuggestion.objects.create(**validated_data)

    class Meta:
        model = KeywordSuggestion
        fields = '__all__'
        read_only_fields = ['status', 'approved_by', 'created_at', 'updated_at']
