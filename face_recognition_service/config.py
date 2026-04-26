"""
Configuration for the Face Recognition Service
"""
import os
from pathlib import Path


def _parse_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_allowed_origins():
    raw_origins = (
        os.getenv("FACE_SERVICE_ALLOWED_ORIGINS")
        or os.getenv("FRONTEND_URL")
        or os.getenv("APP_URL")
        or os.getenv("CLIENT_URL")
        or "http://localhost:3000,http://127.0.0.1:3000"
    )

    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["http://localhost:3000", "http://127.0.0.1:3000"]

# Service Configuration
SERVICE_PORT = int(os.getenv("FACE_SERVICE_PORT", 5001))
SERVICE_HOST = os.getenv("FACE_SERVICE_HOST", "localhost")
DEBUG_MODE = os.getenv("DEBUG_MODE", "False").lower() == "true"
REQUEST_TIMEOUT = 30  # seconds for request processing timeout
ALLOWED_ORIGINS = _parse_allowed_origins()
FACE_SERVICE_API_KEY = os.getenv("FACE_SERVICE_API_KEY", "").strip()
FACE_SERVICE_ENFORCE_API_KEY = _parse_bool(
    os.getenv("FACE_SERVICE_ENFORCE_API_KEY", "false"),
    default=False,
)
FACE_SERVICE_ENFORCE_INTERNAL_CLIENT = _parse_bool(
    os.getenv("FACE_SERVICE_ENFORCE_INTERNAL_CLIENT", "false"),
    default=False,
)
FACE_SERVICE_INTERNAL_CLIENT_HEADER = "X-Face-Service-Client"
FACE_SERVICE_INTERNAL_CLIENT_VALUE = os.getenv(
    "FACE_SERVICE_INTERNAL_CLIENT_VALUE",
    "billsutra-backend",
).strip() or "billsutra-backend"

# Face Recognition Parameters
FACE_RECOGNITION_DISTANCE_THRESHOLD = float(
    os.getenv("FACE_RECOGNITION_DISTANCE_THRESHOLD", "0.60")
)
MIN_CONFIDENCE_LEVEL = float(os.getenv("MIN_CONFIDENCE_LEVEL", "0.70"))
MAX_FACE_DETECTION_ATTEMPTS = 5
FACE_DETECTION_TIMEOUT = 30

# Image/Webcam Configuration
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB max image size
SUPPORTED_IMAGE_FORMATS = ["jpg", "jpeg", "png"]
MAX_FACES_DEFAULT = 1  # For authentication, expect single face
MAX_FACES_REGISTRATION = 10  # Higher limit for registration

# Logging Configuration
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
LOG_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# Error Codes - Standardized error codes for API responses
class ErrorCode:
    INVALID_FILE_TYPE = "INVALID_FILE_TYPE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    NO_FILE_UPLOADED = "NO_FILE_UPLOADED"
    IMAGE_PROCESSING_ERROR = "IMAGE_PROCESSING_ERROR"
    FACE_NOT_DETECTED = "FACE_NOT_DETECTED"
    MULTIPLE_FACES_DETECTED = "MULTIPLE_FACES_DETECTED"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    INVALID_CONTENT_TYPE = "INVALID_CONTENT_TYPE"
    MISSING_IMAGE_FIELD = "MISSING_IMAGE_FIELD"
    INVALID_IMAGE_DATA = "INVALID_IMAGE_DATA"

# Error messages mapped to error codes
ERROR_MESSAGES = {
    ErrorCode.INVALID_FILE_TYPE: "Invalid file type. Only JPG, JPEG, and PNG formats are allowed.",
    ErrorCode.FILE_TOO_LARGE: f"File size exceeds maximum allowed size of {MAX_IMAGE_SIZE // (1024*1024)}MB.",
    ErrorCode.NO_FILE_UPLOADED: "No file was uploaded in the request.",
    ErrorCode.IMAGE_PROCESSING_ERROR: "Failed to process the image. The file may be corrupted or invalid.",
    ErrorCode.FACE_NOT_DETECTED: "No face was detected in the image. Please ensure your face is clearly visible.",
    ErrorCode.MULTIPLE_FACES_DETECTED: "Multiple faces detected. Please ensure only one face is in the frame.",
    ErrorCode.INTERNAL_SERVER_ERROR: "An internal server error occurred. Please try again later.",
    ErrorCode.INVALID_CONTENT_TYPE: "Invalid content type. Use multipart/form-data or application/json.",
    ErrorCode.MISSING_IMAGE_FIELD: "Missing 'image' field in the request.",
    ErrorCode.INVALID_IMAGE_DATA: "Invalid or corrupted image data.",
}

# Storage Configuration
DATA_DIR = Path(__file__).parent / "data"
FACE_ENCODINGS_DIR = DATA_DIR / "face_encodings"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
FACE_ENCODINGS_DIR.mkdir(exist_ok=True)
