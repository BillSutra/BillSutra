"""
Configuration for the Face Recognition Service
"""
import os
from pathlib import Path

# Service Configuration
SERVICE_PORT = int(os.getenv("FACE_SERVICE_PORT", 5001))
SERVICE_HOST = os.getenv("FACE_SERVICE_HOST", "localhost")
DEBUG_MODE = os.getenv("DEBUG_MODE", "True").lower() == "true"

# Face Recognition Parameters
FACE_RECOGNITION_DISTANCE_THRESHOLD = 0.45  # Stricter matching to reduce partial-face accepts
MIN_CONFIDENCE_LEVEL = 0.82  # Higher confidence requirement for successful auth
MAX_FACE_DETECTION_ATTEMPTS = 5  # Max attempts to detect a face
FACE_DETECTION_TIMEOUT = 30  # Timeout in seconds for face detection

# Image/Webcam Configuration
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB max image size
SUPPORTED_IMAGE_FORMATS = ["image/jpeg", "image/png", "image/jpg"]
WEBCAM_RESOLUTION = (640, 480)  # Standard webcam resolution
WEBCAM_FPS = 30  # Frames per second

# Storage Configuration
DATA_DIR = Path(__file__).parent / "data"
FACE_ENCODINGS_DIR = DATA_DIR / "face_encodings"

# Error messages for debugging
ERROR_MESSAGES = {
    "NO_FACE_DETECTED": "Could not detect any face in the image. Please ensure your face is clearly visible.",
    "MULTIPLE_FACES_DETECTED": "Multiple faces detected. Please ensure only one face is in the frame.",
    "FACE_NOT_CLEAR": "Face image is not clear enough. Please adjust lighting and camera angle.",
    "FACE_TOO_SMALL": "Face is too small in the image. Please move closer to the camera.",
    "FACE_TOO_LARGE": "Face is too large in the image. Please move away from the camera.",
    "IMAGE_INVALID": "Invalid image format or corrupted image data.",
    "IMAGE_TOO_LARGE": "Image size exceeds maximum allowed size.",
    "ENCODING_FAILED": "Failed to generate face encoding. Please try again.",
    "NO_MATCH_FOUND": "Face does not match any registered faces. Please try again.",
    "MATCH_LOW_CONFIDENCE": "Face match confidence is too low. Please try again.",
    "WEBCAM_ACCESS_DENIED": "Cannot access webcam. Please check permissions.",
    "WEBCAM_NOT_AVAILABLE": "No webcam detected on this device.",
    "SERVICE_ERROR": "Face recognition service encountered an error. Please try again.",
    "DATABASE_ERROR": "Database error occurred. Please contact support.",
}
