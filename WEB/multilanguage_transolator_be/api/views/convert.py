import os
import tempfile
import uuid
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import requests
import logging
from ..services.convert_api import convert_pdf_to_format, get_supported_formats
from ..services.upload_to_s3 import upload_to_s3, upload_file_path_to_s3
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Use upload_file_path_to_s3 directly from services — no wrapper needed

class ConvertFileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            # Get parameters from request
            file_url = request.data.get('file_url')
            target_format = request.data.get('target_format', '').lower()
            original_filename = request.data.get('original_filename', 'converted_file')
            
            # Validate parameters
            if not file_url:
                return JsonResponse({
                    'error': 'file_url is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if not target_format:
                return JsonResponse({
                    'error': 'target_format is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if target format is supported
            supported_formats = get_supported_formats()
            if target_format not in supported_formats:
                return JsonResponse({
                    'error': f'Unsupported target format. Supported formats: {", ".join(supported_formats)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if source file is PDF
            if not file_url.lower().endswith('.pdf'):
                return JsonResponse({
                    'error': 'Only PDF files can be converted'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create temporary directories for processing
            temp_input_dir = tempfile.mkdtemp()
            temp_output_dir = tempfile.mkdtemp()
            
            try:
                # Download the PDF file from S3
                pdf_filename = f"input_file_{uuid.uuid4().hex}.pdf"
                pdf_path = os.path.join(temp_input_dir, pdf_filename)
                
                logger.info(f"Downloading file from: {file_url}")
                response = requests.get(file_url, timeout=30)
                response.raise_for_status()
                
                with open(pdf_path, 'wb') as f:
                    f.write(response.content)
                
                logger.info(f"File downloaded to: {pdf_path}")
                
                # Convert the file using ConvertAPI
                logger.info(f"Converting PDF to {target_format.upper()}")
                conversion_success = convert_pdf_to_format(
                    pdf_file=pdf_path,
                    output_dir=temp_output_dir,
                    target_format=target_format
                )
                
                if not conversion_success:
                    return JsonResponse({
                        'error': 'File conversion failed'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
                # Find the converted file
                converted_files = [f for f in os.listdir(temp_output_dir) 
                                 if f.endswith(f'.{target_format}')]
                
                if not converted_files:
                    return JsonResponse({
                        'error': 'Converted file not found'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
                converted_file_path = os.path.join(temp_output_dir, converted_files[0])
                
                # Generate new filename for converted file
                base_name = os.path.splitext(original_filename)[0]
                # For S3 storage - use UUID to avoid conflicts
                s3_filename = f"{base_name}_converted_{uuid.uuid4().hex[:8]}.{target_format}"
                # For user download - keep original name with new extension
                converted_filename = f"{base_name}.{target_format}"
                
                # Upload converted file to S3
                bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME', 'torays3')  # Use same var as upload_to_s3.py
                logger.info(f"Uploading converted file to S3: {s3_filename}")
                
                converted_file_url = upload_file_path_to_s3(
                    file_path=converted_file_path,
                    bucket_name=bucket_name,
                    object_name=f"converted/{s3_filename}",
                    original_filename=converted_filename
                )
                
                if not converted_file_url:
                    return JsonResponse({
                        'error': 'Failed to upload converted file to S3'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
                logger.info(f"Conversion successful. File available at: {converted_file_url}")
                
                return JsonResponse({
                    'success': True,
                    'message': f'File successfully converted from PDF to {target_format.upper()}',
                    'converted_file': {
                        'url': converted_file_url,
                        'filename': converted_filename,
                        'format': target_format.upper(),
                        'original_filename': original_filename
                    }
                }, status=status.HTTP_200_OK)
                
            finally:
                # Clean up temporary files
                import shutil
                try:
                    shutil.rmtree(temp_input_dir)
                    shutil.rmtree(temp_output_dir)
                except Exception as e:
                    logger.warning(f"Failed to clean up temp directories: {str(e)}")
        
        except requests.RequestException as e:
            logger.error(f"Error downloading file: {str(e)}")
            return JsonResponse({
                'error': f'Failed to download source file: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            logger.error(f"Conversion error: {str(e)}")
            return JsonResponse({
                'error': f'An error occurred during conversion: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SupportedFormatsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Return list of supported conversion formats"""
        try:
            formats = get_supported_formats()
            return JsonResponse({
                'supported_formats': formats,
                'input_format': 'PDF',
                'output_formats': formats
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error getting supported formats: {str(e)}")
            return JsonResponse({
                'error': 'Failed to get supported formats'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
