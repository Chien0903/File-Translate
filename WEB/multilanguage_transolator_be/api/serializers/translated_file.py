from rest_framework import serializers
from ..models import TranslatedFile

class TranslatedFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TranslatedFile
        fields = [
            'id', 
            'original_file_url', 
            'original_file_name',
            'translated_file_url', 
            'original_language', 
            'target_language', 
            'file_type', 
            'created_at', 
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at'] 