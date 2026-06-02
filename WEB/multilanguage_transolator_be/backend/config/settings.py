# Add this near your other settings
import os
from pathlib import Path

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Google Cloud credentials path
GOOGLE_CREDS_PATH = os.path.join(BASE_DIR.parent, 'credentials', 'google-translate-key.json')
