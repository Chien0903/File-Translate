"""
S3 upload/delete service for file storage.
"""
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
import os
import uuid
import sys
import time
import logging
import tempfile
from urllib.parse import quote

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)

# Add Translate_v2 to path for pdf_to_docx
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../../../'))
sys.path.append(project_root)

try:
    from Translate_v2.translate_pdf import pdf_to_docx
except ImportError:
    pdf_to_docx = None


# ======= Content-Type Mapping =======

CONTENT_TYPE_MAP = {
    '.pdf':  ('application/pdf', 'inline'),
    '.docx': ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'attachment'),
    '.xlsx': ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'attachment'),
    '.xls':  ('application/vnd.ms-excel', 'attachment'),
    '.xlsm': ('application/vnd.ms-excel.sheet.macroEnabled.12', 'attachment'),
    '.xlsb': ('application/vnd.ms-excel.sheet.binary.macroEnabled.12', 'attachment'),
    '.csv':  ('text/csv', 'attachment'),
    '.pptx': ('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'attachment'),
}


def _get_content_metadata(filename, original_filename=None):
    """
    Get content_type and content_disposition for a file based on its extension.
    
    Returns:
        tuple: (content_type, content_disposition)
    """
    ext = os.path.splitext(filename)[1].lower()
    content_type, disposition_type = CONTENT_TYPE_MAP.get(ext, ('binary/octet-stream', 'attachment'))

    if disposition_type == 'inline':
        content_disposition = 'inline'
    elif original_filename:
        content_disposition = _build_content_disposition(original_filename)
    else:
        content_disposition = 'attachment'

    return content_type, content_disposition


def _sanitize_filename(filename: str) -> str:
    """Remove line breaks and quotes from filename for safe HTTP headers."""
    if not filename:
        return "download"
    sanitized = filename.replace("\r", "").replace("\n", "").replace('"', '')
    sanitized = sanitized.strip()
    return sanitized or "download"


def _build_content_disposition(original_filename: str) -> str:
    """RFC 6266: provide both ASCII fallback and UTF-8 encoded filename."""
    safe_name = _sanitize_filename(original_filename)
    ascii_fallback = safe_name.encode('ascii', 'ignore').decode('ascii') or 'download'
    utf8_encoded = quote(safe_name.encode('utf-8'))
    return f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{utf8_encoded}'


def _get_s3_client():
    """Create and return a configured S3 client."""
    return boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_S3_REGION_NAME')
    )


def _upload_with_retry(s3_client, file_obj, bucket_name, object_name, extra_args, max_retries=3):
    """Upload file to S3 with retry logic for transient SignatureDoesNotMatch errors."""
    for attempt in range(max_retries):
        try:
            s3_client.upload_fileobj(
                file_obj,
                bucket_name,
                object_name,
                ExtraArgs=extra_args
            )
            return True
        except ClientError as e:
            msg = str(e)
            if 'SignatureDoesNotMatch' in msg and attempt < max_retries - 1:
                time.sleep(0.5 * (2 ** attempt))
                continue
            raise
    return False


# ======= Upload Functions =======

def upload_to_s3(file, bucket_name, object_name=None):
    """
    Upload an in-memory file object to S3 bucket.
    
    :param file: File-like object (e.g., from request.FILES)
    :param bucket_name: S3 bucket name
    :param object_name: S3 object name. If not specified, file.name is used
    :return: URL of the uploaded file if successful, else None
    """
    if object_name is None:
        object_name = file.name

    s3_client = _get_s3_client()
    content_type, content_disposition = _get_content_metadata(object_name, getattr(file, 'name', None))

    try:
        _upload_with_retry(
            s3_client, file, bucket_name, object_name,
            {'ContentDisposition': content_disposition, 'ContentType': content_type}
        )
        logger.info(f"File {object_name} uploaded to {bucket_name}/{object_name}")
        return f"https://{bucket_name}.s3.amazonaws.com/{object_name}"
    except FileNotFoundError:
        logger.error("The file was not found")
        return None
    except NoCredentialsError:
        logger.error("AWS credentials not available")
        return None
    except ClientError as e:
        logger.error(f"Error uploading file: {e}")
        return None
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        return None


def upload_file_path_to_s3(file_path, bucket_name, object_name=None, original_filename=None):
    """
    Upload a file to an S3 bucket from file path.

    :param file_path: Path to file on disk
    :param bucket_name: S3 bucket name
    :param object_name: S3 object name. If not specified, file_name is used
    :param original_filename: Original filename for Content-Disposition header
    :return: URL of the uploaded file if successful, else None
    """
    if object_name is None:
        object_name = os.path.basename(file_path)

    s3_client = _get_s3_client()
    content_type, content_disposition = _get_content_metadata(object_name, original_filename)

    try:
        with open(file_path, 'rb') as file_obj:
            _upload_with_retry(
                s3_client, file_obj, bucket_name, object_name,
                {'ContentDisposition': content_disposition, 'ContentType': content_type}
            )

        logger.info(f"File {object_name} uploaded to {bucket_name}/{object_name}")
        return f"https://{bucket_name}.s3.amazonaws.com/{object_name}"
    except FileNotFoundError:
        logger.error("The file was not found")
        return None
    except NoCredentialsError:
        logger.error("AWS credentials not available")
        return None
    except ClientError as e:
        logger.error(f"Error uploading file: {e}")
        return None
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        return None


def delete_from_s3(bucket_name, object_name):
    """
    Delete a file from an S3 bucket.

    :param bucket_name: S3 bucket name
    :param object_name: S3 object key (e.g., 'uploads/abc123.pdf')
    :return: True if deleted successfully, False otherwise
    """
    try:
        s3_client = _get_s3_client()
        s3_client.delete_object(Bucket=bucket_name, Key=object_name)
        return True
    except NoCredentialsError:
        logger.error("AWS credentials not available.")
        return False
    except Exception as e:
        logger.error(f"Failed to delete from S3: {str(e)}")
        return False


# ======= Upload View =======

@csrf_exempt
def upload_file_to_s3(request):
    if request.method == 'POST':
        try:
            if 'file' not in request.FILES:
                return JsonResponse({'error': 'No file provided'}, status=400)

            file = request.FILES['file']
            bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME')

            extension = file.name.split('.')[-1].lower()
            hashed_name = f"{uuid.uuid4().hex}.{extension}"
            object_name = f"uploads/{hashed_name}"

            public_url = upload_to_s3(file, bucket_name, object_name)
            
            if not public_url:
                return JsonResponse({'error': 'Failed to upload file to S3'}, status=500)

            response_data = {
                'publicUrl': public_url,
                'originalFileName': file.name,
                's3Key': object_name  
            }

            return JsonResponse(response_data)
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Method not allowed'}, status=405)
