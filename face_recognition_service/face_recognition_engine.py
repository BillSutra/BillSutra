"""
Core Face Recognition Engine
Handles face detection, encoding, and matching with comprehensive error handling
"""
import cv2
import face_recognition
import numpy as np
from pathlib import Path
from typing import Tuple, List, Optional, Dict, Any
import logging
from config import (
    FACE_RECOGNITION_DISTANCE_THRESHOLD,
    MIN_CONFIDENCE_LEVEL,
    MAX_IMAGE_SIZE,
    SUPPORTED_IMAGE_FORMATS,
    ERROR_MESSAGES,
)

# Configure logging for debugging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FaceRecognitionError(Exception):
    """Base exception for facial recognition errors"""
    def __init__(self, error_code: str, message: str = None):
        self.error_code = error_code
        self.message = message or ERROR_MESSAGES.get(error_code, "Unknown error occurred")
        super().__init__(self.message)


class ImageProcessingError(FaceRecognitionError):
    """Error during image processing"""
    pass


class FaceDetectionError(FaceRecognitionError):
    """Error during face detection"""
    pass


class FaceEncodingError(FaceRecognitionError):
    """Error during face encoding"""
    pass


class FaceMatchError(FaceRecognitionError):
    """Error during face matching"""
    pass


class FaceRecognitionEngine:
    """
    Core engine for face recognition operations with comprehensive error handling
    """
    
    def __init__(self):
        self.logger = logger
        self.logger.info("Initializing Face Recognition Engine")
        
    def validate_image_data(self, image_data: bytes) -> bool:
        """
        Validate image data before processing
        
        Args:
            image_data: Raw image bytes
            
        Returns:
            bool: True if valid
            
        Raises:
            ImageProcessingError: If validation fails
        """
        try:
            if not image_data or len(image_data) == 0:
                self.logger.error("Image data is empty")
                raise ImageProcessingError("IMAGE_INVALID", "Image data is empty")
            
            if len(image_data) > MAX_IMAGE_SIZE:
                self.logger.error(f"Image size {len(image_data)} exceeds MAX_IMAGE_SIZE {MAX_IMAGE_SIZE}")
                raise ImageProcessingError("IMAGE_TOO_LARGE")
            
            return True
        except ImageProcessingError:
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error in image validation: {str(e)}")
            raise ImageProcessingError("IMAGE_INVALID", f"Image validation error: {str(e)}")
    
    def load_image_from_bytes(self, image_data: bytes) -> np.ndarray:
        """
        Load image from bytes data
        
        Args:
            image_data: Raw image bytes
            
        Returns:
            np.ndarray: Image array in RGB format
            
        Raises:
            ImageProcessingError: If image loading fails
        """
        try:
            self.logger.debug("Loading image from bytes")
            self.validate_image_data(image_data)
            
            # Convert bytes to numpy array
            nparr = np.frombuffer(image_data, np.uint8)
            
            # Decode image
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                self.logger.error("Failed to decode image")
                raise ImageProcessingError("IMAGE_INVALID")
            
            # Convert BGR to RGB
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            self.logger.debug(f"Image loaded successfully. Shape: {img_rgb.shape}")
            return img_rgb
            
        except ImageProcessingError:
            raise
        except Exception as e:
            self.logger.error(f"Error loading image from bytes: {str(e)}")
            raise ImageProcessingError("IMAGE_INVALID", f"Failed to load image: {str(e)}")
    
    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detect all faces in the image
        
        Args:
            image: Image array in RGB format
            
        Returns:
            List of face locations as (top, right, bottom, left) tuples
            
        Raises:
            FaceDetectionError: If face detection fails or invalid results
        """
        try:
            self.logger.debug(f"Detecting faces in image. Shape: {image.shape}")
            
            if image is None or image.size == 0:
                self.logger.error("Invalid image provided for face detection")
                raise FaceDetectionError("NO_FACE_DETECTED", "Invalid image data")
            
            # Detect faces using face_recognition library
            face_locations = face_recognition.face_locations(image, model="hog")
            
            self.logger.info(f"Detected {len(face_locations)} face(s)")
            
            if len(face_locations) == 0:
                self.logger.warning("No faces detected in image")
                raise FaceDetectionError("NO_FACE_DETECTED")
            
            if len(face_locations) > 1:
                self.logger.warning(f"Multiple faces detected ({len(face_locations)}). Expected only 1.")
                raise FaceDetectionError("MULTIPLE_FACES_DETECTED")
            
            # Validate face size (ensure face is not too small or too large)
            top, right, bottom, left = face_locations[0]
            face_height = bottom - top
            face_width = right - left
            image_height, image_width = image.shape[:2]
            
            # Face should be at least 20% of image but less than 80%
            face_area_ratio = (face_height * face_width) / (image_height * image_width)
            
            if face_area_ratio < 0.04:  # Less than 20x20 pixels roughly
                self.logger.warning(f"Face too small. Area ratio: {face_area_ratio}")
                raise FaceDetectionError("FACE_TOO_SMALL")
            
            if face_area_ratio > 0.8:
                self.logger.warning(f"Face too large. Area ratio: {face_area_ratio}")
                raise FaceDetectionError("FACE_TOO_LARGE")

            # Ensure the face is fully in frame (not clipped near edges)
            margin_x = int(image_width * 0.04)
            margin_y = int(image_height * 0.04)
            if left <= margin_x or top <= margin_y or right >= (image_width - margin_x) or bottom >= (image_height - margin_y):
                self.logger.warning(
                    f"Face too close to edge. box={(top,right,bottom,left)} margins={(margin_y,margin_x)} img={(image_height,image_width)}"
                )
                raise FaceDetectionError("FACE_NOT_CLEAR")
            
            self.logger.debug(f"Face validation passed. Area ratio: {face_area_ratio}")
            return face_locations
            
        except FaceDetectionError:
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error during face detection: {str(e)}")
            raise FaceDetectionError("NO_FACE_DETECTED", f"Face detection error: {str(e)}")
    
    def extract_face_features(self, image: np.ndarray, face_location: Tuple[int, int, int, int]) -> np.ndarray:
        """
        Extract face features/encoding from a detected face
        
        Args:
            image: Image array in RGB format
            face_location: Face location as (top, right, bottom, left) tuple
            
        Returns:
            np.ndarray: Face encoding (128-dimensional vector)
            
        Raises:
            FaceEncodingError: If encoding extraction fails
        """
        try:
            self.logger.debug("Extracting face features")
            
            # Generate face encoding
            face_encodings = face_recognition.face_encodings(image, [face_location], num_jitters=1)
            
            if len(face_encodings) == 0:
                self.logger.error("Failed to generate face encoding")
                raise FaceEncodingError("ENCODING_FAILED")
            
            encoding = face_encodings[0]
            self.logger.debug(f"Face encoding generated. Shape: {encoding.shape}")
            
            return encoding
            
        except FaceEncodingError:
            raise
        except Exception as e:
            self.logger.error(f"Error during face feature extraction: {str(e)}")
            raise FaceEncodingError("ENCODING_FAILED", f"Feature extraction error: {str(e)}")

    def validate_face_completeness(
        self,
        image: np.ndarray,
        face_location: Tuple[int, int, int, int],
    ) -> None:
        """
        Validate that lower-face landmarks are present (mouth + chin),
        preventing partial upper-face logins.
        """
        try:
            landmarks_list = face_recognition.face_landmarks(
                image,
                [face_location],
                model="large",
            )
            if len(landmarks_list) == 0:
                raise FaceDetectionError("FACE_NOT_CLEAR")

            landmarks = landmarks_list[0]
            required_features = [
                "chin",
                "nose_tip",
                "top_lip",
                "bottom_lip",
                "left_eye",
                "right_eye",
            ]
            for feature_name in required_features:
                if feature_name not in landmarks or len(landmarks[feature_name]) == 0:
                    self.logger.warning(f"Missing facial feature landmark: {feature_name}")
                    raise FaceDetectionError("FACE_NOT_CLEAR")

            top, right, bottom, left = face_location
            face_height = bottom - top

            mouth_points = landmarks["top_lip"] + landmarks["bottom_lip"]
            mouth_center_y = float(np.mean([point[1] for point in mouth_points]))
            chin_max_y = max(point[1] for point in landmarks["chin"])
            nose_center_y = float(np.mean([point[1] for point in landmarks["nose_tip"]]))

            # Enforce expected vertical ordering and lower-face visibility.
            if mouth_center_y <= nose_center_y:
                self.logger.warning(
                    f"Invalid facial geometry (mouth above/equal nose). mouth_y={mouth_center_y}, nose_y={nose_center_y}"
                )
                raise FaceDetectionError("FACE_NOT_CLEAR")

            if mouth_center_y < (top + face_height * 0.52):
                self.logger.warning(
                    f"Mouth landmark too high, likely partial upper-face capture. mouth_y={mouth_center_y}, threshold={top + face_height * 0.52}"
                )
                raise FaceDetectionError("FACE_NOT_CLEAR")

            if chin_max_y < (top + face_height * 0.82):
                self.logger.warning(
                    f"Chin landmark not visible enough. chin_y={chin_max_y}, threshold={top + face_height * 0.82}"
                )
                raise FaceDetectionError("FACE_NOT_CLEAR")
        except FaceDetectionError:
            raise
        except Exception as e:
            self.logger.error(f"Face completeness validation failed: {str(e)}")
            raise FaceDetectionError("FACE_NOT_CLEAR")
    
    def register_face(self, image_data: bytes) -> Dict[str, Any]:
        """
        Register a new face by capturing and encoding it
        
        Args:
            image_data: Raw image bytes from camera/file
            
        Returns:
            Dictionary containing:
                - success: bool
                - encoding: List of face encoding values
                - message: str
                - error_code: Optional error code
                
        Raises:
            FaceRecognitionError: If registration fails
        """
        try:
            self.logger.info("Starting face registration process")
            
            # Load and validate image
            image = self.load_image_from_bytes(image_data)
            
            # Detect faces
            face_locations = self.detect_faces(image)

            # Validate that the whole face (including mouth/chin) is visible.
            self.validate_face_completeness(image, face_locations[0])
            
            # Extract face encoding
            face_encoding = self.extract_face_features(image, face_locations[0])
            
            # Convert to list for JSON serialization
            encoding_list = face_encoding.tolist()
            
            self.logger.info("Face registration successful")
            return {
                "success": True,
                "encoding": encoding_list,
                "message": "Face registered successfully",
                "error_code": None
            }
            
        except FaceRecognitionError as e:
            self.logger.error(f"Face registration failed: {e.message}")
            return {
                "success": False,
                "encoding": None,
                "message": e.message,
                "error_code": e.error_code
            }
        except Exception as e:
            self.logger.error(f"Unexpected error during face registration: {str(e)}")
            return {
                "success": False,
                "encoding": None,
                "message": ERROR_MESSAGES.get("SERVICE_ERROR"),
                "error_code": "SERVICE_ERROR"
            }
    
    def authenticate_face(self, image_data: bytes, registered_encoding: List[float]) -> Dict[str, Any]:
        """
        Authenticate a face against a registered encoding
        
        Args:
            image_data: Raw image bytes from camera/file
            registered_encoding: Previously stored face encoding
            
        Returns:
            Dictionary containing:
                - success: bool
                - matched: bool
                - confidence: float between 0 and 1 (1.0 = perfect match)
                - distance: float (Euclidean distance, lower = better match)
                - message: str
                - error_code: Optional error code
        """
        try:
            self.logger.info("Starting face authentication process")
            
            # Load and validate image
            image = self.load_image_from_bytes(image_data)
            
            # Detect faces
            face_locations = self.detect_faces(image)

            # Validate that the whole face (including mouth/chin) is visible.
            self.validate_face_completeness(image, face_locations[0])
            
            # Extract face encoding
            face_encoding = self.extract_face_features(image, face_locations[0])
            
            # Convert registered encoding to numpy array if it's a list
            if isinstance(registered_encoding, list):
                registered_encoding = np.array(registered_encoding)
            
            # Calculate face distance
            face_distance = face_recognition.face_distance([registered_encoding], face_encoding)[0]
            
            # Confidence is inverse of distance (higher confidence = lower distance)
            confidence = 1 - (face_distance / 2.0)  # Normalize to 0-1 range
            confidence = max(0, min(1, confidence))  # Clamp to 0-1
            
            self.logger.debug(f"Face distance: {face_distance}, Confidence: {confidence}")
            
            # Check if face matches
            matched = face_distance < FACE_RECOGNITION_DISTANCE_THRESHOLD
            
            if matched:
                if confidence < MIN_CONFIDENCE_LEVEL:
                    self.logger.warning(
                        f"Match confidence too low. Confidence: {confidence}, Min: {MIN_CONFIDENCE_LEVEL}, Distance: {face_distance}"
                    )
                    return {
                        "success": True,
                        "matched": False,
                        "confidence": float(confidence),
                        "distance": float(face_distance),
                        "message": ERROR_MESSAGES.get("MATCH_LOW_CONFIDENCE"),
                        "error_code": "MATCH_LOW_CONFIDENCE"
                    }
                self.logger.info(f"Face authentication successful. Confidence: {confidence}")
                return {
                    "success": True,
                    "matched": True,
                    "confidence": float(confidence),
                    "distance": float(face_distance),
                    "message": "Face authenticated successfully",
                    "error_code": None
                }
            else:
                self.logger.warning(f"Face does not match. Distance: {face_distance}, Threshold: {FACE_RECOGNITION_DISTANCE_THRESHOLD}")
                return {
                    "success": True,
                    "matched": False,
                    "confidence": float(confidence),
                    "distance": float(face_distance),
                    "message": ERROR_MESSAGES.get("NO_MATCH_FOUND"),
                    "error_code": "NO_MATCH_FOUND"
                }
                
        except FaceRecognitionError as e:
            self.logger.error(f"Face authentication failed: {e.message}")
            return {
                "success": False,
                "matched": False,
                "confidence": 0.0,
                "distance": 2.0,
                "message": e.message,
                "error_code": e.error_code
            }
        except Exception as e:
            self.logger.error(f"Unexpected error during face authentication: {str(e)}")
            return {
                "success": False,
                "matched": False,
                "confidence": 0.0,
                "distance": 2.0,
                "message": ERROR_MESSAGES.get("SERVICE_ERROR"),
                "error_code": "SERVICE_ERROR"
            }
    
    def validate_encoding(self, encoding: List[float]) -> bool:
        """
        Validate a face encoding
        
        Args:
            encoding: Face encoding as list of floats
            
        Returns:
            bool: True if valid
            
        Raises:
            ValueError: If encoding is invalid
        """
        if not isinstance(encoding, (list, np.ndarray)):
            raise ValueError("Encoding must be a list or numpy array")
        
        if isinstance(encoding, list):
            encoding = np.array(encoding)
        
        if len(encoding) != 128:
            raise ValueError(f"Encoding must have 128 dimensions, got {len(encoding)}")
        
        return True


# Create global engine instance
engine = FaceRecognitionEngine()
