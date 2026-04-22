"""
Flask API for Face Recognition Service
Exposes face registration and authentication endpoints
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from face_recognition_engine import engine, FaceRecognitionError
import logging
from config import SERVICE_HOST, SERVICE_PORT, DEBUG_MODE, ERROR_MESSAGES

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG_MODE else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure error handlers
@app.errorhandler(400)
def bad_request(error):
    """Handle 400 Bad Request errors"""
    logger.error(f"Bad request: {error}")
    return jsonify({
        "success": False,
        "message": "Invalid request format",
        "error_code": "INVALID_REQUEST"
    }), 400

@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle 413 Payload Too Large errors"""
    logger.error(f"Request too large: {error}")
    return jsonify({
        "success": False,
        "message": ERROR_MESSAGES.get("IMAGE_TOO_LARGE"),
        "error_code": "IMAGE_TOO_LARGE"
    }), 413

@app.errorhandler(500)
def internal_server_error(error):
    """Handle 500 Internal Server errors"""
    logger.error(f"Internal server error: {error}")
    return jsonify({
        "success": False,
        "message": ERROR_MESSAGES.get("SERVICE_ERROR"),
        "error_code": "SERVICE_ERROR"
    }), 500

# Routes
@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    logger.debug("Health check request")
    return jsonify({
        "status": "healthy",
        "service": "Face Recognition Service",
        "version": "1.0.0"
    }), 200

@app.route("/api/face/register", methods=["POST"])
def register_face():
    """
    Register a new face
    
    Request:
        - Content-Type: application/octet-stream or multipart/form-data
        - Body: Raw image bytes or image file
    
    Response:
        - success: bool
        - encoding: List of 128 floats (face encoding)
        - message: str
        - error_code: Optional error code
    """
    try:
        logger.info("Received face registration request")
        
        # Get image data from request
        image_data = None
        
        if request.content_type and 'application/octet-stream' in request.content_type:
            # Binary image data
            image_data = request.get_data()
            logger.debug(f"Received binary image data: {len(image_data)} bytes")
        elif request.content_type and 'multipart/form-data' in request.content_type:
            # File upload
            if 'image' not in request.files:
                logger.error("No 'image' field in multipart form data")
                return jsonify({
                    "success": False,
                    "message": "No 'image' field in request",
                    "error_code": "MISSING_IMAGE"
                }), 400
            
            image_file = request.files['image']
            image_data = image_file.read()
            logger.debug(f"Received image file: {image_file.filename} ({len(image_data)} bytes)")
        else:
            logger.error("Invalid content type for face registration")
            return jsonify({
                "success": False,
                "message": "Content-Type must be application/octet-stream or multipart/form-data",
                "error_code": "INVALID_CONTENT_TYPE"
            }), 400
        
        if not image_data:
            logger.error("No image data in request")
            return jsonify({
                "success": False,
                "message": "No image data provided",
                "error_code": "NO_IMAGE_DATA"
            }), 400
        
        # Register face
        result = engine.register_face(image_data)
        
        status_code = 200 if result["success"] else 400
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Unexpected error in register_face: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "message": ERROR_MESSAGES.get("SERVICE_ERROR"),
            "error_code": "SERVICE_ERROR"
        }), 500

@app.route("/api/face/authenticate", methods=["POST"])
def authenticate_face():
    """
    Authenticate a face against a registered encoding
    
    Request:
        {
            "image": "<base64 encoded image or binary>",
            "encoding": [128 float values],
            "image_type": "base64" or "binary" (optional)
        }
        OR
        multipart/form-data with 'image' file and 'encoding' JSON field
    
    Response:
        - success: bool
        - matched: bool
        - confidence: float (0-1)
        - distance: float
        - message: str
        - error_code: Optional error code
    """
    try:
        logger.info("Received face authentication request")
        
        # Get encoding from request
        encoding = None
        image_data = None
        
        if request.content_type and 'multipart/form-data' in request.content_type:
            # multipart form data
            if 'image' not in request.files:
                logger.error("No 'image' field in multipart form data")
                return jsonify({
                    "success": False,
                    "message": "No 'image' field in request",
                    "error_code": "MISSING_IMAGE"
                }), 400
            
            if 'encoding' not in request.form:
                logger.error("No 'encoding' field in multipart form data")
                return jsonify({
                    "success": False,
                    "message": "No 'encoding' field in request",
                    "error_code": "MISSING_ENCODING"
                }), 400
            
            image_file = request.files['image']
            image_data = image_file.read()
            
            import json
            try:
                encoding = json.loads(request.form['encoding'])
            except json.JSONDecodeError as e:
                logger.error(f"Invalid encoding JSON: {str(e)}")
                return jsonify({
                    "success": False,
                    "message": "Invalid encoding JSON",
                    "error_code": "INVALID_ENCODING"
                }), 400
                
            logger.debug(f"Received image file and encoding from multipart")
        
        elif request.is_json:
            # JSON request
            data = request.get_json()
            encoding = data.get('encoding')
            
            if 'image' not in data:
                logger.error("No 'image' field in JSON request")
                return jsonify({
                    "success": False,
                    "message": "No 'image' field in request",
                    "error_code": "MISSING_IMAGE"
                }), 400
            
            # Handle base64 encoded image
            import base64
            try:
                image_base64 = data['image']
                image_data = base64.b64decode(image_base64)
                logger.debug(f"Decoded base64 image: {len(image_data)} bytes")
            except Exception as e:
                logger.error(f"Failed to decode base64 image: {str(e)}")
                return jsonify({
                    "success": False,
                    "message": "Invalid base64 image data",
                    "error_code": "INVALID_IMAGE_DATA"
                }), 400
        
        elif request.content_type and 'application/octet-stream' in request.content_type:
            # Binary image + encoding in headers or query params
            image_data = request.get_data()
            
            # Get encoding from query params or headers
            encoding_str = request.args.get('encoding') or request.headers.get('X-Face-Encoding')
            if not encoding_str:
                logger.error("No encoding provided with binary image")
                return jsonify({
                    "success": False,
                    "message": "No encoding provided",
                    "error_code": "MISSING_ENCODING"
                }), 400
            
            import json
            try:
                encoding = json.loads(encoding_str)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid encoding: {str(e)}")
                return jsonify({
                    "success": False,
                    "message": "Invalid encoding format",
                    "error_code": "INVALID_ENCODING"
                }), 400
        
        else:
            logger.error("Invalid content type for face authentication")
            return jsonify({
                "success": False,
                "message": "Content-Type must be application/json or multipart/form-data",
                "error_code": "INVALID_CONTENT_TYPE"
            }), 400
        
        # Validate inputs
        if not image_data:
            logger.error("No image data in request")
            return jsonify({
                "success": False,
                "message": "No image data provided",
                "error_code": "NO_IMAGE_DATA"
            }), 400
        
        if not encoding:
            logger.error("No encoding in request")
            return jsonify({
                "success": False,
                "message": "No encoding provided",
                "error_code": "MISSING_ENCODING"
            }), 400
        
        # Validate encoding
        try:
            engine.validate_encoding(encoding)
        except ValueError as e:
            logger.error(f"Invalid encoding: {str(e)}")
            return jsonify({
                "success": False,
                "matched": False,
                "message": f"Invalid encoding: {str(e)}",
                "error_code": "INVALID_ENCODING"
            }), 400
        
        # Authenticate face
        result = engine.authenticate_face(image_data, encoding)
        
        status_code = 200 if result["success"] else 400
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Unexpected error in authenticate_face: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "matched": False,
            "message": ERROR_MESSAGES.get("SERVICE_ERROR"),
            "error_code": "SERVICE_ERROR"
        }), 500

@app.route("/api/face/config", methods=["GET"])
def get_config():
    """Get current face recognition configuration"""
    logger.debug("Requested face recognition config")
    from config import (
        FACE_RECOGNITION_DISTANCE_THRESHOLD,
        MIN_CONFIDENCE_LEVEL,
        MAX_IMAGE_SIZE,
        WEBCAM_RESOLUTION,
    )
    
    return jsonify({
        "distance_threshold": FACE_RECOGNITION_DISTANCE_THRESHOLD,
        "min_confidence": MIN_CONFIDENCE_LEVEL,
        "max_image_size": MAX_IMAGE_SIZE,
        "webcam_resolution": WEBCAM_RESOLUTION,
        "encoding_dimensions": 128
    }), 200

if __name__ == "__main__":
    logger.info(f"Starting Face Recognition Service on {SERVICE_HOST}:{SERVICE_PORT}")
    app.run(host=SERVICE_HOST, port=SERVICE_PORT, debug=DEBUG_MODE)
