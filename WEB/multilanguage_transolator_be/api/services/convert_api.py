import convertapi
import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure ConvertAPI
convertapi.api_secret = os.getenv('CONVERTAPI_API_CREDENTIALS')

# Setup logging
logger = logging.getLogger(__name__)

def pdf_to_docx(pdf_file, output_dir):
    """Convert PDF to DOCX format"""
    try:
        # Check if API key is set
        if not convertapi.api_secret or convertapi.api_secret == '':
            logger.error("ConvertAPI secret not configured")
            return False
            
        result = convertapi.convert('docx', {
            'File': pdf_file
        }, from_format='pdf')
        result.save_files(output_dir)
        return True
    except Exception as e:
        error_msg = str(e)
        if 'Invalid user credentials' in error_msg or '4011' in error_msg:
            logger.error("ConvertAPI credentials invalid or expired. Please update CONVERTAPI_API_CREDENTIALS in .env")
        else:
            logger.error(f"Error converting PDF to DOCX: {error_msg}")
        return False

def pdf_to_xlsx(pdf_file, output_dir):
    """Convert PDF to XLSX format"""
    try:
        result = convertapi.convert('xlsx', {
            'File': pdf_file
        }, from_format='pdf')
        result.save_files(output_dir)
        return True
    except Exception as e:
        logger.error(f"Error converting PDF to XLSX: {str(e)}")
        return False

def pdf_to_pptx(pdf_file, output_dir):
    """Convert PDF to PPTX format"""
    try:
        result = convertapi.convert('pptx', {
            'File': pdf_file
        }, from_format='pdf')
        result.save_files(output_dir)
        return True
    except Exception as e:
        logger.error(f"Error converting PDF to PPTX: {str(e)}")
        return False

def convert_pdf_to_format(pdf_file, output_dir, target_format):
    """
    Universal PDF converter function
    
    Args:
        pdf_file: Path to PDF file or file object
        output_dir: Output directory for converted file
        target_format: Target format (docx, xlsx, pptx)
    
    Returns:
        bool: True if conversion successful, False otherwise
    """
    format_functions = {
        'docx': pdf_to_docx,
        'xlsx': pdf_to_xlsx,
        'pptx': pdf_to_pptx
    }
    
    if target_format.lower() not in format_functions:
        logger.error(f"Unsupported format: {target_format}")
        return False
    
    try:
        return format_functions[target_format.lower()](pdf_file, output_dir)
    except Exception as e:
        logger.error(f"Error converting PDF to {target_format}: {str(e)}")
        return False

def get_supported_formats():
    """Return list of supported conversion formats"""
    return ['docx', 'xlsx', 'pptx']

# New helpers for spreadsheet conversions
def to_xlsx(input_file_path: str, output_dir: str) -> str:
    """
    Convert given spreadsheet/text file to XLSX using ConvertAPI.

    Supported source formats: xlsm, xlsb, xls, csv

    Returns absolute path to the converted .xlsx file.
    Raises Exception on failure or unsupported format.
    """
    try:
        ext = os.path.splitext(input_file_path)[1].lower().lstrip('.')
        if ext not in ['xlsm', 'xlsb', 'xls', 'csv']:
            raise ValueError(f"Unsupported source format for to_xlsx: {ext}")

        result = convertapi.convert('xlsx', {
            'File': input_file_path
        }, from_format=ext)

        saved_files = result.save_files(output_dir)
        # ConvertAPI's save_files returns list of saved paths
        if isinstance(saved_files, list) and len(saved_files) > 0:
            # Ensure absolute path
            saved_path = saved_files[0]
            return os.path.abspath(saved_path)
        raise RuntimeError("ConvertAPI did not return saved file path")
    except Exception as e:
        logger.error(f"Error converting {input_file_path} to XLSX: {str(e)}")
        raise