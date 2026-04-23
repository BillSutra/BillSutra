"""
Flask API for Face Recognition Service
Production-grade implementation with robust error handling, validation, and logging
"""
import base64
import functools
import os
import time
import traceback
import uuid
from typing import Any, Callable, Dict, List, Optional

import numpy as np
from flask import Flask, g, jsonify, request
from flask_cors import CORS

from config import (
    DEBUG_MODE as CONFIG_DEBUG_MODE,
    ERROR_MESSAGES,
    LOG_FORMAT,
    MAX_IMAGE_SIZE,
    REQUEST_TIMEOUT,
    SERVICE_HOST,
    SERVICE_PORT,
    SUPPORTED_IMAGE_FORMATS,
    ErrorCode,
)
from face_recognition_engine import FaceRecognitionError, ValidationError, engine
import logging

DEBUG_MODE = CONFIG_DEBUG_MODE or os.getenv("DEBUG", "false").lower() == "true"

logging.basicConfig(
    level=logging.DEBUG if DEBUG_MODE else logging.INFO,
    format=LOG_FORMAT,
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_SIZE

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Face-Encoding"],
            "max_age": 3600,
        }
    },
)


def build_success_response(
    data: Optional[Dict[str, Any]] = None,
    message: Optional[str] = None,
):
    body: Dict[str, Any] = {
        "success": True,
        "data": data or {},
    }
    if message:
        body["message"] = message
    return body


def build_error_response(
    error: str,
    code: str,
    details: Optional[Any] = None,
):
    body: Dict[str, Any] = {
        "success": False,
        "error": error,
        "code": code,
    }
    if details is not None and DEBUG_MODE:
        body["details"] = details
    return body


def json_success(
    data: Optional[Dict[str, Any]] = None,
    message: Optional[str] = None,
    status_code: int = 200,
):
    return jsonify(build_success_response(data=data, message=message)), status_code


def json_error(
    error: str,
    code: str,
    status_code: int = 400,
    details: Optional[Any] = None,
):
    return jsonify(build_error_response(error=error, code=code, details=details)), status_code


def get_debug_details(error: Exception) -> Optional[str]:
    if not DEBUG_MODE:
        return None
    return traceback.format_exc()


def log_request(event: str, **fields: Any) -> None:
    payload = {
        "event": event,
        "request_id": getattr(g, "request_id", None),
        "path": request.path if request else None,
        "method": request.method if request else None,
        **fields,
    }
    logger.info(payload)


def log_error(event: str, error: Exception, **fields: Any) -> None:
    payload = {
        "event": event,
        "request_id": getattr(g, "request_id", None),
        "path": request.path if request else None,
        "method": request.method if request else None,
        "error_type": type(error).__name__,
        "error_message": str(error),
        **fields,
    }
    logger.error(payload, exc_info=True)


def detect_image_format(file_data: bytes) -> Optional[str]:
    if file_data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if file_data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    return None


def sanitize_encoding(encoding: List[Any]) -> List[float]:
    sanitized: List[float] = []
    for value in encoding:
        numeric_value = float(value)
        if np.isnan(numeric_value) or np.isinf(numeric_value):
            raise ValidationError(
                ErrorCode.INVALID_IMAGE_DATA,
                "Face encoding contained invalid numeric values.",
            )
        sanitized.append(numeric_value)
    return sanitized


def validate_encoding_payload(encoding: Any) -> List[float]:
    if not isinstance(encoding, list):
        raise ValidationError(
            ErrorCode.INVALID_IMAGE_DATA,
            "Encoding must be an array of 128 numeric values.",
        )

    if len(encoding) != 128:
        raise ValidationError(
            ErrorCode.INVALID_IMAGE_DATA,
            f"Encoding must contain 128 values, received {len(encoding)}.",
        )

    if not all(isinstance(value, (int, float)) for value in encoding):
        raise ValidationError(
            ErrorCode.INVALID_IMAGE_DATA,
            "Encoding contains non-numeric values.",
        )

    return sanitize_encoding(encoding)


def extract_file_from_request() -> bytes:
    content_type = (request.content_type or "").lower()
    file_data = None

    if "multipart/form-data" in content_type:
        file_obj = request.files.get("image")
        if file_obj is None:
            raise ValidationError(
                ErrorCode.MISSING_IMAGE_FIELD,
                "Missing 'image' field in the request.",
            )

        if not file_obj.filename:
            raise ValidationError(
                ErrorCode.NO_FILE_UPLOADED,
                "No file was selected for upload.",
            )

        extension = file_obj.filename.rsplit(".", 1)[-1].lower() if "." in file_obj.filename else ""
        if extension not in SUPPORTED_IMAGE_FORMATS:
            raise ValidationError(
                ErrorCode.INVALID_FILE_TYPE,
                f"Unsupported image type '{extension}'. Allowed: {', '.join(SUPPORTED_IMAGE_FORMATS)}.",
            )

        file_data = file_obj.read()

    elif request.is_json:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            raise ValidationError(
                ErrorCode.INVALID_IMAGE_DATA,
                "Invalid JSON request body.",
            )

        encoded_image = payload.get("image")
        if not isinstance(encoded_image, str) or not encoded_image.strip():
            raise ValidationError(
                ErrorCode.MISSING_IMAGE_FIELD,
                "Missing base64-encoded 'image' field in the request body.",
            )

        normalized = encoded_image.split(",", 1)[-1]
        try:
            file_data = base64.b64decode(normalized, validate=True)
        except Exception as error:
            raise ValidationError(
                ErrorCode.INVALID_IMAGE_DATA,
                "Invalid base64 image data.",
            ) from error

    elif "application/octet-stream" in content_type:
        file_data = request.get_data()

    else:
        raise ValidationError(
            ErrorCode.INVALID_CONTENT_TYPE,
            f"Unsupported content type '{content_type or 'unknown'}'.",
        )

    if not file_data:
        raise ValidationError(
            ErrorCode.NO_FILE_UPLOADED,
            "No image data was provided.",
        )

    if len(file_data) > MAX_IMAGE_SIZE:
        raise ValidationError(
            ErrorCode.FILE_TOO_LARGE,
            f"Image exceeds the maximum size of {MAX_IMAGE_SIZE // (1024 * 1024)}MB.",
        )

    detected_format = detect_image_format(file_data)
    if detected_format not in SUPPORTED_IMAGE_FORMATS:
        raise ValidationError(
            ErrorCode.INVALID_FILE_TYPE,
            "Only JPG, JPEG, and PNG images are supported.",
        )

    return file_data


def api_guard(route_handler: Callable[..., Any]):
    @functools.wraps(route_handler)
    def wrapped(*args: Any, **kwargs: Any):
        try:
            return route_handler(*args, **kwargs)
        except FaceRecognitionError as error:
            log_error("face_service.domain_error", error)
            status_code = 422 if error.error_code in (
                ErrorCode.FACE_NOT_DETECTED,
                ErrorCode.MULTIPLE_FACES_DETECTED,
            ) else 400
            if error.error_code == ErrorCode.INTERNAL_SERVER_ERROR:
                status_code = 500
            return json_error(
                error.message,
                error.error_code,
                status_code=status_code,
                details=error.details,
            )
        except Exception as error:
            log_error("face_service.unhandled_error", error)
            return json_error(
                ERROR_MESSAGES[ErrorCode.INTERNAL_SERVER_ERROR],
                ErrorCode.INTERNAL_SERVER_ERROR,
                status_code=500,
                details=get_debug_details(error),
            )

    return wrapped


@app.before_request
def before_request():
    g.request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    g.request_started_at = time.perf_counter()
    log_request(
        "face_service.request_received",
        remote_addr=request.remote_addr,
        content_type=request.content_type,
        content_length=request.content_length,
    )


@app.after_request
def after_request(response):
    duration_ms = round((time.perf_counter() - getattr(g, "request_started_at", time.perf_counter())) * 1000, 2)
    response.headers["X-Request-ID"] = getattr(g, "request_id", "")
    log_request(
        "face_service.request_completed",
        status_code=response.status_code,
        duration_ms=duration_ms,
    )
    return response


@app.errorhandler(400)
def bad_request(error):
    return json_error("Invalid request format.", "INVALID_REQUEST", status_code=400)


@app.errorhandler(404)
def not_found(error):
    return json_error("Resource not found.", "NOT_FOUND", status_code=404)


@app.errorhandler(413)
def request_entity_too_large(error):
    return json_error(
        ERROR_MESSAGES[ErrorCode.FILE_TOO_LARGE],
        ErrorCode.FILE_TOO_LARGE,
        status_code=413,
    )


@app.errorhandler(Exception)
def handle_exception(error):
    log_error("face_service.flask_error_handler", error)
    return json_error(
        ERROR_MESSAGES[ErrorCode.INTERNAL_SERVER_ERROR],
        ErrorCode.INTERNAL_SERVER_ERROR,
        status_code=500,
        details=get_debug_details(error),
    )


@app.route("/health", methods=["GET"])
@api_guard
def health_check():
    engine_ok = True
    try:
        _ = engine.logger
    except Exception as error:
        engine_ok = False
        log_error("face_service.health_check_failed", error)

    status = "healthy" if engine_ok else "degraded"
    return json_success(
        data={
            "status": status,
            "service": "Face Recognition Service",
            "version": "1.0.0",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "debug_mode": DEBUG_MODE,
            "request_timeout_seconds": REQUEST_TIMEOUT,
        },
        message="Health check completed.",
        status_code=200 if engine_ok else 503,
    )


@app.route("/api/face/register", methods=["POST"])
@api_guard
def register_face():
    file_data = extract_file_from_request()
    log_request("face_service.register.processing_started", image_bytes=len(file_data))

    image = engine.load_image_from_bytes(file_data)
    face_locations = engine.detect_faces(image, max_faces=1)

    if len(face_locations) == 0:
        raise ValidationError(
            ErrorCode.FACE_NOT_DETECTED,
            ERROR_MESSAGES[ErrorCode.FACE_NOT_DETECTED],
        )

    if len(face_locations) > 1:
        raise ValidationError(
            ErrorCode.MULTIPLE_FACES_DETECTED,
            ERROR_MESSAGES[ErrorCode.MULTIPLE_FACES_DETECTED],
        )

    engine.validate_face_completeness(image, face_locations[0])
    encoding_np = engine.extract_face_features(image, face_locations[0])
    encoding = sanitize_encoding(encoding_np.tolist())

    processing_time_ms = round((time.perf_counter() - g.request_started_at) * 1000, 2)
    log_request(
        "face_service.register.processing_completed",
        faces_detected=len(face_locations),
        encoding_length=len(encoding),
        processing_time_ms=processing_time_ms,
    )

    return json_success(
        data={
            "encoding": encoding,
            "faces_detected": len(face_locations),
            "processing_time_ms": processing_time_ms,
        },
        message="Face registered successfully.",
    )


@app.route("/api/face/authenticate", methods=["POST"])
@api_guard
def authenticate_face():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise ValidationError(
            ErrorCode.INVALID_CONTENT_TYPE,
            "Authentication requires a JSON body containing 'image' and 'encoding'.",
        )

    file_data = extract_file_from_request()
    encoding = validate_encoding_payload(payload.get("encoding"))
    log_request("face_service.authenticate.processing_started", image_bytes=len(file_data))

    result = engine.authenticate_face(file_data, encoding)

    if not isinstance(result, dict) or "success" not in result:
        raise ValidationError(
            ErrorCode.INTERNAL_SERVER_ERROR,
            "Face engine returned an invalid response.",
        )

    if not result.get("success"):
        code = result.get("code", ErrorCode.INTERNAL_SERVER_ERROR)
        message = result.get("message") or result.get("error") or ERROR_MESSAGES.get(code, "Authentication failed.")
        status_code = 422 if code in (
            ErrorCode.FACE_NOT_DETECTED,
            ErrorCode.MULTIPLE_FACES_DETECTED,
        ) else 500
        return json_error(
            message,
            code,
            status_code=status_code,
            details=result.get("details"),
        )

    processing_time_ms = result.get("processing_time_ms")
    if processing_time_ms is None:
        processing_time_ms = round((time.perf_counter() - g.request_started_at) * 1000, 2)

    return json_success(
        data={
            "matched": bool(result.get("matched")),
            "confidence": float(result.get("confidence", 0.0)),
            "distance": float(result.get("distance", 2.0)),
            "processing_time_ms": processing_time_ms,
            "code": result.get("code"),
        },
        message=result.get("message", "Authentication completed."),
    )


@app.route("/api/face/detect", methods=["POST"])
@api_guard
def detect_faces():
    file_data = extract_file_from_request()
    result = engine.process_image(file_data, require_single_face=False)

    if not result.get("success"):
        code = result.get("code", ErrorCode.INTERNAL_SERVER_ERROR)
        message = result.get("error") or result.get("message") or "Detection failed."
        status_code = 422 if code in (
            ErrorCode.FACE_NOT_DETECTED,
            ErrorCode.MULTIPLE_FACES_DETECTED,
        ) else 500
        return json_error(
            message,
            code,
            status_code=status_code,
            details=result.get("details"),
        )

    return json_success(
        data={
            "faces_detected": result["faces_detected"],
            "face_locations": [list(location) for location in result["face_locations"]],
            "processing_time_ms": result["processing_time_ms"],
        },
        message=f"Detected {result['faces_detected']} face(s).",
    )


@app.route("/api/face/config", methods=["GET"])
@api_guard
def get_config():
    from config import FACE_RECOGNITION_DISTANCE_THRESHOLD, MIN_CONFIDENCE_LEVEL

    return json_success(
        data={
            "distance_threshold": FACE_RECOGNITION_DISTANCE_THRESHOLD,
            "min_confidence": MIN_CONFIDENCE_LEVEL,
            "max_image_size_bytes": MAX_IMAGE_SIZE,
            "max_image_size_mb": MAX_IMAGE_SIZE // (1024 * 1024),
            "supported_formats": SUPPORTED_IMAGE_FORMATS,
            "encoding_dimensions": 128,
        },
        message="Configuration retrieved successfully.",
    )


@app.route("/api/errors", methods=["GET"])
@api_guard
def get_error_codes():
    return json_success(
        data={"error_codes": {code: ERROR_MESSAGES[code] for code in ERROR_MESSAGES}},
        message="Error codes retrieved successfully.",
    )


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Starting Face Recognition Service")
    logger.info(f"Host: {SERVICE_HOST}")
    logger.info(f"Port: {SERVICE_PORT}")
    logger.info(f"Debug Mode: {DEBUG_MODE}")
    logger.info(f"Max Image Size: {MAX_IMAGE_SIZE // (1024 * 1024)}MB")
    logger.info(f"Supported Formats: {', '.join(SUPPORTED_IMAGE_FORMATS)}")
    logger.info("=" * 60)

    app.run(
        host=SERVICE_HOST,
        port=SERVICE_PORT,
        debug=False,
        threaded=True,
    )
