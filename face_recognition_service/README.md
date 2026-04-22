# Face Recognition Service

A Python-based facial recognition service that provides face registration and authentication capabilities.

## Required Features (Baseline)

- Single-face registration with robust validation and encoding generation
- Deterministic face authentication with confidence and distance scoring
- Clear API-level error codes for client and backend troubleshooting
- Operational stability on standard low-resolution webcam captures
- Configurable thresholds and debug controls for environment-specific tuning

## Updated Features (April 2026)

- Added stronger low-quality webcam guidance and practical tuning defaults
- Improved error-handling documentation across registration and authentication paths
- Clarified integration contract with Node.js backend for payload formats
- Documented service behavior and safety expectations for production hardening

## Features

- **Face Registration**: Capture and encode a user's face for later authentication
- **Face Authentication**: Match a captured face against a registered encoding
- **Comprehensive Error Handling**: Detailed error messages for debugging
- **Low-Quality Webcam Support**: Works with standard webcam resolutions (640x480)
- **Distance-based Matching**: Uses Euclidean distance for face comparison
- **Confidence Scoring**: Provides confidence levels for authentication results

## Installation

### Prerequisites
- Python 3.8+
- pip (Python package manager)
- Visual C++ Build Tools (required for dlib on Windows)

### Setup

1. Navigate to the service directory:
```bash
cd face_recognition_service
```

2. Create a virtual environment (optional but recommended):
```bash
python -m venv venv
source venv/Scripts/activate  # On Windows
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Service

```bash
python app.py
```

The service will start on `http://localhost:5001` by default.

### Configuration

Edit `.env` file to configure:
- `FACE_SERVICE_PORT`: Service port (default: 5001)
- `FACE_SERVICE_HOST`: Service host (default: localhost)
- `DEBUG_MODE`: Enable debug logging (default: True)

## API Endpoints

### Health Check
```
GET /health
```
Returns service health status.

### Register Face
```
POST /api/face/register
```

**Request:**
- Content-Type: `application/octet-stream` or `multipart/form-data`
- Body: Raw image bytes or image file

**Response:**
```json
{
  "success": true,
  "encoding": [/* 128 float values */],
  "message": "Face registered successfully",
  "error_code": null
}
```

### Authenticate Face
```
POST /api/face/authenticate
```

**Request (JSON):**
```json
{
  "image": "<base64 encoded image>",
  "encoding": [/* 128 float values from registration */]
}
```

**Request (Form Data):**
- `image`: Image file
- `encoding`: JSON string of encoding array

**Response:**
```json
{
  "success": true,
  "matched": true,
  "confidence": 0.95,
  "distance": 0.32,
  "message": "Face authenticated successfully",
  "error_code": null
}
```

### Get Configuration
```
GET /api/face/config
```

Returns current face recognition configuration parameters.

## Error Codes

| Error Code | Description |
|-----------|-------------|
| `NO_FACE_DETECTED` | No face found in the image |
| `MULTIPLE_FACES_DETECTED` | Multiple faces detected (expecting 1) |
| `FACE_TOO_SMALL` | Face is too small in the image |
| `FACE_TOO_LARGE` | Face is too large in the image |
| `IMAGE_INVALID` | Invalid or corrupted image data |
| `IMAGE_TOO_LARGE` | Image size exceeds maximum limit |
| `ENCODING_FAILED` | Failed to generate face encoding |
| `NO_MATCH_FOUND` | Face doesn't match registered face |
| `SERVICE_ERROR` | Internal service error |

## Testing with Low-Quality Webcams

This service is designed to work with standard low-quality webcams (640x480). For best results:

1. **Lighting**: Ensure good lighting conditions (preferably natural light)
2. **Distance**: Position your face about 12-18 inches from the camera
3. **Angle**: Keep your face straight and centered
4. **Consistency**: Keep similar lighting and positioning during registration and authentication

## Debugging

The service logs detailed information for debugging. Check the console output for:
- Image processing steps
- Face detection results
- Encoding generation status
- Face distance and confidence values
- Error details with stack traces

### Common Issues

**Issue**: "No face detected"
- **Solution**: Check lighting, move closer to camera, ensure face is clearly visible

**Issue**: "Multiple faces detected"
- **Solution**: Ensure only one person is in the frame

**Issue**: "Face too small/large"
- **Solution**: Adjust distance from camera (12-18 inches is optimal)

**Issue**: Import errors on Windows
- **Solution**: Install Visual C++ Build Tools from: https://visualstudio.microsoft.com/build-tools/

## Integration with Node.js Backend

The service provides HTTP endpoints that your Node.js backend can call:

```javascript
// Example: Register a face
const registerFace = async (imageBuffer) => {
  const response = await fetch('http://localhost:5001/api/face/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: imageBuffer
  });
  return response.json();
};

// Example: Authenticate a face
const authenticateFace = async (imageBuffer, encoding) => {
  const response = await fetch('http://localhost:5001/api/face/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageBuffer.toString('base64'),
      encoding: encoding
    })
  });
  return response.json();
};
```

## Performance Notes

- **Registration**: ~2-3 seconds per image
- **Authentication**: ~2-3 seconds per image
- **Memory**: Uses ~200-300 MB RAM
- **CPU**: Moderate CPU usage (may vary with image resolution)

## Security Notes

- Face encodings are encrypted before storage in the database
- Never transmit face encodings over unencrypted channels
- Use HTTPS in production
- Implement rate limiting for authentication attempts
- Store encodings securely with database encryption

## Future Enhancements

- Protection against phone images
- Multiple face detection per user
- Liveness detection (to prevent spoofing)
- GPU acceleration for faster processing
- Batch processing support
- Face clustering and analytics
