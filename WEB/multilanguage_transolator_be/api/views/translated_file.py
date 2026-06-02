from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from collections import defaultdict
import os

from ..models.translated_file import TranslatedFile
from ..serializers.translated_file import TranslatedFileSerializer
from ..services.upload_to_s3 import delete_from_s3

class FileHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        files = TranslatedFile.objects.filter(user=user).order_by('-created_at')

        # Group by original_file_name
        grouped = defaultdict(list)
        for file in files:
            grouped[(file.original_file_name, file.original_file_url, file.file_type, file.original_language)].append({
                "id": file.id,
                "language_code": file.target_language,
                "language_name": self.get_language_name(file.target_language),
                "translated_file_url": file.translated_file_url,
                "file_type": file.file_type,
                "created_at": file.created_at,
            })

        result = []
        for (name, url, file_type, original_language), translations in grouped.items():
            created_at = min(t["created_at"] for t in translations)
            result.append({
                "id": translations[0]["id"],
                "original_file_name": name,
                "original_file_url": url,
                "file_type": file_type,
                "original_language": original_language,
                "created_at": created_at,
                "translations": translations
            })
        return Response(result)
    def get_language_name(self, code):
        return {
            "vi": "Vietnamese",
            "ja": "Japanese",
            "en": "English",
            "zh-CN": "Chinese (Simplified)",
            "zh-TW": "Chinese (Traditional)"
        }.get(code, code)

class DeleteTranslatedFileView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            file_obj = TranslatedFile.objects.get(id=pk, user=request.user)
            bucket_name = os.getenv("AWS_STORAGE_BUCKET_NAME")

            # Lấy object key từ URL (ví dụ: 'translated/abc123.pdf')
            s3_url = file_obj.translated_file_url
            object_key = s3_url.split(f"https://{bucket_name}.s3.amazonaws.com/")[-1]

            # Xoá trên S3
            deleted = delete_from_s3(bucket_name, object_key)

            # Xoá bản ghi trong DB
            file_obj.delete()

            return Response(
                {"message": "File deleted", "s3_deleted": deleted},
                status=status.HTTP_200_OK,
            )
        except TranslatedFile.DoesNotExist:
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
