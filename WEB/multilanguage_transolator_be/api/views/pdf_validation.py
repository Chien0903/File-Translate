import os
import tempfile
import requests
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging
import sys

# Thêm đường dẫn để import từ Translate_v2
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../../../'))
sys.path.append(project_root)

try:
    from Translate_v2.OCR.router import is_pdf_truly_editable
except ImportError:
    is_pdf_truly_editable = None

from ..services.upload_to_s3 import delete_from_s3

logger = logging.getLogger(__name__)

class CheckPDFEditableView(APIView):
    """
    API endpoint to check if a PDF file is editable (contains text, not scanned images)
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            # Check if validation is enabled (can be disabled via env var)
            validation_enabled = os.getenv('PDF_VALIDATION_ENABLED', 'true').lower() == 'true'
            if not validation_enabled:
                logger.info("PDF validation is disabled via environment variable")
                return JsonResponse({
                    'is_editable': True,
                    'message': 'PDF validation disabled'
                }, status=status.HTTP_200_OK)
            
            # Check if the function is available
            if is_pdf_truly_editable is None:
                logger.error("is_pdf_truly_editable function not available")
                # Return success to allow upload if function unavailable
                return JsonResponse({
                    'is_editable': True,
                    'message': 'PDF validation function not available'
                }, status=status.HTTP_200_OK)
            
            # Get file URL from request
            file_url = request.data.get('file_url')
            
            if not file_url:
                return JsonResponse({
                    'error': 'file_url is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if it's a PDF file
            if not file_url.lower().endswith('.pdf'):
                return JsonResponse({
                    'is_editable': True,  # Non-PDF files pass validation
                    'message': 'Not a PDF file, skipping validation'
                }, status=status.HTTP_200_OK)
            
            # Create temporary file to download PDF
            temp_dir = tempfile.mkdtemp()
            temp_pdf_path = os.path.join(temp_dir, 'temp_check.pdf')
            
            try:
                # Download PDF file from S3 with streaming to handle large files
                logger.info(f"Downloading PDF from: {file_url}")
                response = requests.get(file_url, timeout=60, stream=True)
                response.raise_for_status()
                
                # Save to temporary file with streaming
                with open(temp_pdf_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                # Check file size
                file_size = os.path.getsize(temp_pdf_path)
                logger.info(f"PDF downloaded successfully. Size: {file_size} bytes")
                
                if file_size == 0:
                    logger.error("Downloaded PDF file is empty")
                    return JsonResponse({
                        'error': 'Downloaded PDF file is empty'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Check if PDF is editable using the function from router.py
                logger.info(f"Starting PDF validation check...")
                try:
                    editable = is_pdf_truly_editable(temp_pdf_path)
                    logger.info(f"PDF validation result: editable={editable}")
                except Exception as pdf_check_error:
                    logger.error(f"Error checking PDF editability: {str(pdf_check_error)}", exc_info=True)
                    # If we can't check, assume it's editable to allow upload
                    logger.warning("Assuming PDF is editable due to check error")
                    return JsonResponse({
                        'is_editable': True,
                        'message': 'PDF validation check failed, assuming editable'
                    }, status=status.HTTP_200_OK)
                
                if editable:
                    logger.info("✓ PDF is editable (contains text)")
                    return JsonResponse({
                        'is_editable': True,
                        'message': 'PDF contains text and is editable'
                    }, status=status.HTTP_200_OK)
                else:
                    logger.info("PDF is scanned/image-only (not editable)")
                    
                    return JsonResponse({
                        'is_editable': False,
                        'message': 'PDF contains scanned pages or images only'
                    }, status=status.HTTP_200_OK)
                    
            finally:
                # Clean up temporary files
                import shutil
                try:
                    shutil.rmtree(temp_dir)
                    logger.info(f"Cleaned up temporary directory: {temp_dir}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temp directory: {str(e)}")
        
        except requests.RequestException as e:
            logger.error(f"Error downloading PDF file: {str(e)}")
            return JsonResponse({
                'error': f'Failed to download PDF file: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            logger.error(f"Error checking PDF: {str(e)}", exc_info=True)
            return JsonResponse({
                'error': f'An error occurred while checking PDF: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

