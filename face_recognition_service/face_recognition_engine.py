"""
Core Face Recognition Engine
Handles face detection, encoding, and matching with comprehensive error handling
"""
import io
import cv2
import face_recognition
import numpy as np
from pathlib import Path
from typing import Tuple, List, Optional, Dict, Any
import logging
import traceback
from config import (
    FACE_MATCH_THRESHOLD,
    FACE_DISTANCE_NORMALIZER,
    MIN_CONFIDENCE_LEVEL,
    MIN_BRIGHTNESS_MEAN,
    MIN_IMAGE_WIDTH,
    MIN_IMAGE_HEIGHT,
    MAX_IMAGE_SIZE,
    SUPPORTED_IMAGE_FORMATS,
    ERROR_MESSAGES,
    ErrorCode,
    LOG_FORMAT,
)

# Configure logging
logging.basicConfig(level=logging.DEBUG, format=LOG_FORMAT)
logger = logging.getLogger(__name__)


class FaceRecognitionError(Exception):
    """Base exception for face recognition errors"""
    def __init__(self, error_code: str, message: str = None, details: str = None):
        self.error_code = error_code
        self.message = message or ERROR_MESSAGES.get(error_code, "Unknown error occurred")
        self.details = details
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "success": False,
            "error": self.message,
            "code": self.error_code,
        }
        if self.details:
            result["details"] = self.details
        return result


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


class ValidationError(FaceRecognitionError):
    """Error during validation"""
    pass


class FaceRecognitionEngine:
    """Core engine for face recognition operations with comprehensive error handling"""

    def __init__(self):
        self.logger = logger
        self.logger.info("Initializing Face Recognition Engine")
        self._warmed_up = False
        self._warm_up_models()

    def _warm_up_models(self) -> None:
        """Warm core detection paths once during startup."""
        try:
            warm_image = np.zeros((MIN_IMAGE_HEIGHT, MIN_IMAGE_WIDTH, 3), dtype=np.uint8)
            face_recognition.face_locations(warm_image, model="hog", number_of_times_to_upsample=0)
            face_recognition.face_landmarks(warm_image, face_locations=[], model="large")
            face_recognition.face_distance(
                [np.zeros(128, dtype=np.float64)],
                np.zeros(128, dtype=np.float64),
            )
            self._warmed_up = True
            self.logger.info("Face recognition models warmed up successfully")
        except Exception as error:
            self.logger.exception("Face recognition warmup failed")
            raise RuntimeError("Failed to warm up face recognition models") from error

    def validate_image_data(self, image_data: bytes) -> bool:
        """Validate image data before processing"""
        if not image_data or len(image_data) == 0:
            raise ValidationError(ErrorCode.NO_FILE_UPLOADED, "Image data is empty")

        if len(image_data) > MAX_IMAGE_SIZE:
            raise ValidationError(
                ErrorCode.FILE_TOO_LARGE,
                f"Image size {len(image_data)} exceeds limit {MAX_IMAGE_SIZE}"
            )

        # Check for minimum valid image size (smallest valid JPEG is usually > 100 bytes)
        if len(image_data) < 100:
            raise ValidationError(ErrorCode.INVALID_IMAGE_DATA, "Image data is too small")

        return True

    def validate_file_type(self, filename: str = None, content_type: str = None) -> bool:
        """Validate file type from filename or content type"""
        if filename:
            ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
            if ext not in SUPPORTED_IMAGE_FORMATS:
                raise ValidationError(
                    ErrorCode.INVALID_FILE_TYPE,
                    f"Invalid file extension '{ext}'. Allowed: {', '.join(SUPPORTED_IMAGE_FORMATS)}"
                )

        if content_type:
            # Handle content types like 'image/jpeg', 'image/png', etc.
            if not content_type.startswith('image/'):
                raise ValidationError(ErrorCode.INVALID_FILE_TYPE, f"Content type must be an image, got '{content_type}'")

            # Extract format from content type
            fmt = content_type.split('/')[-1]
            if fmt == 'jpeg':
                fmt = 'jpg'
            if fmt not in SUPPORTED_IMAGE_FORMATS:
                raise ValidationError(
                    ErrorCode.INVALID_FILE_TYPE,
                    f"Unsupported image format '{fmt}'. Allowed: {', '.join(SUPPORTED_IMAGE_FORMATS)}"
                )

        return True

    def load_image_from_bytes(self, image_data: bytes) -> np.ndarray:
        """Load image from bytes data with comprehensive error handling"""
        try:
            self.logger.debug(f"Loading image from {len(image_data)} bytes")
            self.validate_image_data(image_data)

            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                self.logger.warning("cv2.imdecode returned None - attempting alternate decode")
                # Try with IMREAD_UNCHANGED to catch grayscale or other formats
                img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
                if img is None:
                    raise ImageProcessingError(
                        ErrorCode.IMAGE_PROCESSING_ERROR,
                        "Failed to decode image. File may be corrupted or not a valid image."
                    )

            # Convert grayscale to RGB if needed
            if len(img.shape) == 2:
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
            elif img.shape[2] == 4:
                # RGBA to RGB
                img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
            else:
                # OpenCV decodes color images as BGR; face_recognition expects RGB.
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

            height, width = img.shape[:2]
            if width < MIN_IMAGE_WIDTH or height < MIN_IMAGE_HEIGHT:
                raise ImageProcessingError(
                    ErrorCode.IMAGE_PROCESSING_ERROR,
                    f"Image resolution is too low ({width}x{height}). Minimum supported size is {MIN_IMAGE_WIDTH}x{MIN_IMAGE_HEIGHT}.",
                )

            self.logger.debug(f"Image loaded successfully. Shape: {img.shape}")
            return img

        except ImageProcessingError:
            raise
        except ValidationError:
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error loading image: {str(e)}")
            raise ImageProcessingError(
                ErrorCode.IMAGE_PROCESSING_ERROR,
                f"Failed to load image: {str(e)}",
                details=traceback.format_exc()
            )

    def analyze_image_quality(self, image: np.ndarray) -> Dict[str, float]:
        """Assess image brightness and blur so we can fail fast with clear feedback."""
        grayscale = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        brightness_mean = float(np.mean(grayscale))
        blur_variance = float(cv2.Laplacian(grayscale, cv2.CV_64F).var())
        return {
            "brightness_mean": round(brightness_mean, 2),
            "blur_variance": round(blur_variance, 2),
        }

    def validate_image_quality(self, image: np.ndarray) -> Dict[str, float]:
        metrics = self.analyze_image_quality(image)
        self.logger.debug(
            "Image quality metrics | brightness_mean=%.2f | blur_variance=%.2f",
            metrics["brightness_mean"],
            metrics["blur_variance"],
        )

        if metrics["brightness_mean"] < MIN_BRIGHTNESS_MEAN:
            raise ImageProcessingError(
                ErrorCode.LOW_LIGHT,
                "The image is too dark. Please move to better lighting and try again.",
                details=f"brightness_mean={metrics['brightness_mean']}, min_required={MIN_BRIGHTNESS_MEAN}",
            )

        return metrics

    def detect_faces(self, image: np.ndarray, max_faces: int = 1) -> List[Tuple[int, int, int, int]]:
        """Detect faces in image with comprehensive error handling"""
        try:
            if image is None or image.size == 0:
                raise FaceDetectionError(
                    ErrorCode.IMAGE_PROCESSING_ERROR,
                    "Invalid image provided for face detection"
                )

            self.logger.debug(f"Detecting faces in image. Shape: {image.shape}")

            # Use HOG model for better accuracy, fall back to cnn if available
            try:
                face_locations = face_recognition.face_locations(
                    image,
                    model="hog",
                    number_of_times_to_upsample=1,
                )
            except Exception as hog_error:
                self.logger.warning(f"HOG detection failed: {hog_error}, trying default model")
                face_locations = face_recognition.face_locations(image)

            count = len(face_locations)
            self.logger.info(f"Detected {count} face(s)")

            if count == 0:
                raise FaceDetectionError(
                    ErrorCode.FACE_NOT_DETECTED,
                    "No face detected in the image. Please ensure your face is clearly visible and well-lit."
                )

            if count > max_faces:
                raise FaceDetectionError(
                    ErrorCode.MULTIPLE_FACES_DETECTED,
                    f"Multiple faces detected ({count}). Expected {max_faces}. Please ensure only one face is visible.",
                    details=f"faces_detected={count}, max_allowed={max_faces}"
                )

            # Validate face sizes
            h, w = image.shape[:2]
            for i, (top, right, bottom, left) in enumerate(face_locations):
                face_h = bottom - top
                face_w = right - left
                area_ratio = (face_h * face_w) / (h * w)

                self.logger.debug(f"Face {i+1} area ratio: {area_ratio:.3f}")

                if area_ratio < 0.04:
                    raise FaceDetectionError(
                        ErrorCode.FACE_NOT_DETECTED,
                        f"Face {i+1} is too small in the image. Please move closer to the camera."
                    )

                if area_ratio > 0.8:
                    raise FaceDetectionError(
                        ErrorCode.FACE_NOT_DETECTED,
                        f"Face {i+1} is too large. Please move away from the camera."
                    )

            return face_locations

        except FaceDetectionError:
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error during face detection: {str(e)}")
            raise FaceDetectionError(
                ErrorCode.FACE_NOT_DETECTED,
                f"Face detection failed: {str(e)}",
                details=traceback.format_exc()
            )

    def extract_face_features(self, image: np.ndarray, face_location: Tuple[int, int, int, int]) -> np.ndarray:
        """Extract face encoding with comprehensive error handling"""
        try:
            self.logger.debug(f"Extracting face features for location: {face_location}")

            face_encodings = face_recognition.face_encodings(
                image,
                [face_location],
                num_jitters=1
            )

            if not face_encodings:
                raise FaceEncodingError(
                    ErrorCode.IMAGE_PROCESSING_ERROR,
                    "Failed to generate face encoding. The face may not be clear enough."
                )

            encoding = face_encodings[0]
            self.logger.debug(f"Face encoding generated. Shape: {encoding.shape}, dtype: {encoding.dtype}")
            return encoding

        except FaceEncodingError:
            raise
        except Exception as e:
            self.logger.error(f"Error during face feature extraction: {str(e)}")
            raise FaceEncodingError(
                ErrorCode.IMAGE_PROCESSING_ERROR,
                f"Feature extraction failed: {str(e)}",
                details=traceback.format_exc()
            )

    def validate_face_completeness(
        self,
        image: np.ndarray,
        face_location: Tuple[int, int, int, int],
    ) -> None:
        """Validate that lower-face landmarks are present (mouth + chin)"""
        try:
            landmarks_list = face_recognition.face_landmarks(image, [face_location], model="large")
            if not landmarks_list:
                raise FaceDetectionError(
                    ErrorCode.FACE_NOT_DETECTED,
                    "Could not extract facial landmarks. Image quality may be too low."
                )

            landmarks = landmarks_list[0]
            required_features = ["chin", "nose_tip", "top_lip", "bottom_lip", "left_eye", "right_eye"]

            for feature_name in required_features:
                if feature_name not in landmarks or not landmarks[feature_name]:
                    raise FaceDetectionError(
                        ErrorCode.FACE_NOT_DETECTED,
                        f"Missing facial feature: {feature_name}. Please ensure your full face is visible."
                    )

            top, right, bottom, left = face_location
            face_height = bottom - top

            mouth_points = landmarks["top_lip"] + landmarks["bottom_lip"]
            mouth_center_y = float(np.mean([p[1] for p in mouth_points]))
            chin_max_y = max(p[1] for p in landmarks["chin"])
            nose_center_y = float(np.mean([p[1] for p in landmarks["nose_tip"]]))

            if mouth_center_y <= nose_center_y:
                raise FaceDetectionError(
                    ErrorCode.FACE_NOT_DETECTED,
                    "Invalid facial geometry detected. Please look directly at the camera."
                )

            if mouth_center_y < (top + face_height * 0.52):
                raise FaceDetectionError(
                    ErrorCode.FACE_NOT_DETECTED,
                    "Lower face not sufficiently visible. Please show your full face."
                )

            if chin_max_y < (top + face_height * 0.82):
                raise FaceDetectionError(
                    ErrorCode.FACE_NOT_DETECTED,
                    "Chin not visible in frame. Please adjust camera angle."
                )

        except FaceDetectionError:
            raise
        except Exception as e:
            self.logger.error(f"Face completeness validation failed: {str(e)}")
            raise FaceDetectionError(
                ErrorCode.FACE_NOT_DETECTED,
                f"Face validation failed: {str(e)}",
                details=traceback.format_exc()
            )

    def process_image(self, image_data: bytes, require_single_face: bool = True) -> Dict[str, Any]:
        """
        Core image processing pipeline with error handling and timing

        Returns:
            {
                "success": bool,
                "faces_detected": int,
                "face_locations": list,
                "encoding": list or None,
                "processing_time_ms": float
            }
        """
        import time
        start_time = time.time()

        try:
            self.logger.info(f"Processing image ({len(image_data)} bytes)")

            # Load image
            image = self.load_image_from_bytes(image_data)
            quality_metrics = self.validate_image_quality(image)

            # Detect faces
            max_faces = 1 if require_single_face else 10
            face_locations = self.detect_faces(image, max_faces=max_faces)

            # Validate face completeness for single face scenarios
            if require_single_face:
                self.validate_face_completeness(image, face_locations[0])

            # Extract face encoding
            encoding = self.extract_face_features(image, face_locations[0])

            processing_time = (time.time() - start_time) * 1000
            self.logger.info(f"Image processed successfully in {processing_time:.2f}ms. Faces: {len(face_locations)}")

            return {
                "success": True,
                "faces_detected": len(face_locations),
                "face_locations": face_locations,
                "encoding": encoding.tolist(),
                "processing_time_ms": round(processing_time, 2),
                "image_metrics": quality_metrics,
            }

        except FaceRecognitionError as e:
            processing_time = (time.time() - start_time) * 1000
            self.logger.warning(f"Image processing failed in {processing_time:.2f}ms: {e.error_code} - {e.message}")
            return {
                "success": False,
                "faces_detected": 0,
                "face_locations": [],
                "encoding": None,
                "processing_time_ms": round(processing_time, 2),
                "error": e.message,
                "code": e.error_code,
                "details": e.details if hasattr(e, 'details') else None,
            }
        except Exception as e:
            processing_time = (time.time() - start_time) * 1000
            self.logger.error(f"Unexpected error processing image: {str(e)}")
            return {
                "success": False,
                "faces_detected": 0,
                "face_locations": [],
                "encoding": None,
                "processing_time_ms": round(processing_time, 2),
                "error": ERROR_MESSAGES.get(ErrorCode.INTERNAL_SERVER_ERROR),
                "code": ErrorCode.INTERNAL_SERVER_ERROR,
                "details": traceback.format_exc(),
            }

    def register_face(self, image_data: bytes) -> Dict[str, Any]:
        """Register a new face with comprehensive error handling"""
        try:
            self.logger.info("Starting face registration process")

            result = self.process_image(image_data, require_single_face=True)

            if not result["success"]:
                return {
                    "success": False,
                    "encoding": None,
                    "message": result.get("error", "Registration failed"),
                    "code": result.get("code", ErrorCode.INTERNAL_SERVER_ERROR),
                    "details": result.get("details")
                }

            self.logger.info("Face registration successful")
            return {
                "success": True,
                "encoding": result["encoding"],
                "faces_detected": result["faces_detected"],
                "message": "Face registered successfully",
                "code": None,
                "processing_time_ms": result["processing_time_ms"]
            }

        except Exception as e:
            self.logger.error(f"Unexpected error during face registration: {str(e)}")
            return {
                "success": False,
                "encoding": None,
                "message": ERROR_MESSAGES.get(ErrorCode.INTERNAL_SERVER_ERROR),
                "code": ErrorCode.INTERNAL_SERVER_ERROR,
                "details": traceback.format_exc()
            }

    def authenticate_face(self, image_data: bytes, registered_encoding: List[float]) -> Dict[str, Any]:
        """Authenticate a face against a registered encoding"""
        try:
            self.logger.info("Starting face authentication process")

            # Validate registered encoding
            self.validate_encoding(registered_encoding)

            # Process the image
            result = self.process_image(image_data, require_single_face=True)

            if not result["success"]:
                return {
                    "success": False,
                    "matched": False,
                    "confidence": 0.0,
                    "distance": 2.0,
                    "message": result.get("error", "Authentication failed"),
                    "code": result.get("code", ErrorCode.INTERNAL_SERVER_ERROR),
                    "details": result.get("details"),
                    "processing_time_ms": result["processing_time_ms"]
                }

            # Calculate face distance
            encoding_array = np.array(result["encoding"], dtype=np.float64)
            registered_array = np.array(registered_encoding, dtype=np.float64)

            face_distance = face_recognition.face_distance([registered_array], encoding_array)[0]
            cosine_denominator = np.linalg.norm(registered_array) * np.linalg.norm(encoding_array)
            cosine_similarity = 0.0
            if cosine_denominator > 0:
                cosine_similarity = float(np.dot(registered_array, encoding_array) / cosine_denominator)
            score = float(np.clip((cosine_similarity + 1.0) / 2.0, 0.0, 1.0))
            confidence = float(np.clip(1.0 - (face_distance / FACE_DISTANCE_NORMALIZER), 0.0, 1.0))

            self.logger.debug(
                "Face distance: %.4f, Confidence: %.4f, Score: %.4f, Cosine similarity: %.4f",
                face_distance,
                confidence,
                score,
                cosine_similarity,
            )
            self.logger.info(
                "Face similarity score | distance=%.4f | confidence=%.4f | score=%.4f | threshold=%.4f | min_confidence=%.4f",
                face_distance,
                confidence,
                score,
                FACE_MATCH_THRESHOLD,
                MIN_CONFIDENCE_LEVEL,
            )

            matched = face_distance <= FACE_MATCH_THRESHOLD

            if matched and max(confidence, score) < MIN_CONFIDENCE_LEVEL:
                self.logger.warning(
                    "Match found but confidence too low: confidence=%.4f score=%.4f",
                    confidence,
                    score,
                )
                return {
                    "success": True,
                    "matched": False,
                    "confidence": confidence,
                    "score": score,
                    "distance": float(face_distance),
                    "message": "Match found but confidence too low. Please try again with better lighting.",
                    "code": ErrorCode.LOW_CONFIDENCE,
                    "reason": ErrorCode.LOW_CONFIDENCE,
                    "processing_time_ms": result["processing_time_ms"],
                }

            if matched:
                self.logger.info(f"Face authentication successful. Confidence: {confidence:.4f}")
                return {
                    "success": True,
                    "matched": True,
                    "confidence": confidence,
                    "score": score,
                    "distance": float(face_distance),
                    "message": "Face authenticated successfully",
                    "code": None,
                    "reason": "MATCH_SUCCESS",
                    "processing_time_ms": result["processing_time_ms"],
                }
            else:
                self.logger.warning(f"Face does not match. Distance: {face_distance:.4f}")
                return {
                    "success": True,
                    "matched": False,
                    "confidence": confidence,
                    "score": score,
                    "distance": float(face_distance),
                    "message": "Face did not match the enrolled profile.",
                    "code": "NO_MATCH_FOUND",
                    "reason": "LOW_CONFIDENCE",
                    "processing_time_ms": result["processing_time_ms"],
                }

        except ValidationError as e:
            self.logger.error(f"Validation error in authenticate_face: {e.message}")
            return {
                "success": False,
                "matched": False,
                "confidence": 0.0,
                "score": 0.0,
                "distance": 2.0,
                "message": e.message,
                "code": e.error_code,
                "reason": e.error_code,
                "details": e.details if hasattr(e, 'details') else None,
            }
        except Exception as e:
            self.logger.error(f"Unexpected error during face authentication: {str(e)}")
            return {
                "success": False,
                "matched": False,
                "confidence": 0.0,
                "score": 0.0,
                "distance": 2.0,
                "message": ERROR_MESSAGES.get(ErrorCode.INTERNAL_SERVER_ERROR),
                "code": ErrorCode.INTERNAL_SERVER_ERROR,
                "reason": ErrorCode.INTERNAL_SERVER_ERROR,
                "details": traceback.format_exc(),
            }

    def validate_encoding(self, encoding: List[float]) -> bool:
        """Validate a face encoding vector"""
        if encoding is None:
            raise ValidationError(ErrorCode.INTERNAL_SERVER_ERROR, "Encoding is None")

        if not isinstance(encoding, (list, np.ndarray, tuple)):
            raise ValidationError(
                ErrorCode.INTERNAL_SERVER_ERROR,
                f"Encoding must be a list or array, got {type(encoding).__name__}"
            )

        encoding_arr = np.array(encoding)

        if len(encoding_arr) != 128:
            raise ValidationError(
                ErrorCode.INTERNAL_SERVER_ERROR,
                f"Encoding must have 128 dimensions, got {len(encoding_arr)}"
            )

        if np.any(np.isnan(encoding_arr)) or np.any(np.isinf(encoding_arr)):
            raise ValidationError(
                ErrorCode.INTERNAL_SERVER_ERROR,
                "Encoding contains NaN or infinite values"
            )

        return True


# Create global engine instance
engine = FaceRecognitionEngine()
