# Facial Recognition Login System - Implementation Guide

This guide will help you set up and integrate the facial recognition login system into your BillSutra application.

## Required Features (Baseline)

- Register, authenticate, check, and delete face data through documented APIs
- Cross-service integration among frontend, backend, and Python recognition engine
- Reliable webcam capture flow with clear user feedback and retry paths
- Standardized error codes and troubleshooting for support workflows
- Secure handling of biometric encodings and production deployment guidance

## Updated Features (April 2026)

- End-to-end setup is aligned with current backend and frontend integration points
- Debugging and cURL verification coverage has been expanded for faster issue isolation
- Security and production-hardening guidance has been clarified for live deployments
- Performance expectations and operational considerations are now explicitly documented

## System Architecture

```
┌──────────────────────┐
│   Frontend (Next.js) │
│  - Face Registration │
│  - Face Login        │
└──────────────┬───────┘
               │
               │ HTTP/JSON
               │
       ┌───────▼────────────┐
       │  Backend (Node.js)  │
       │  - API Endpoints    │
       │  - Auth events      │
       │  - DB Operations    │
       └───────┬────────────┘
               │
        ┌──────┼──────┐
        │             │
   ┌────▼────┐   ┌───▼──────────────┐
   │PostgreSQL   Python Service    │
   │(FaceData)   (Face Recognition)│
   └────────┘   └──────┬──────────┘
                       │
                ┌──────▼──────┐
                │  face_recog  │
                │ opencv, lib  │
                └─────────────┘
```

## Prerequisites

### System Requirements

- **Node.js**: v18+
- **Python**: v3.8+
- **PostgreSQL**: Compatible version (already set up)
- **Webcam**: Standard USB or integrated webcam
- **Memory**: At least 500MB free RAM (for Python service)

### Software Requirements

- Git (for version control)
- npm/yarn (Node.js package manager)
- pip (Python package manager)
- Visual C++ Build Tools (Windows only - for dlib compilation)

### Browser Requirements

- Chrome, Firefox, Safari, or Edge (with WebRTC support)
- Camera/Microphone permissions required

## Installation Steps

### Step 1: Database Migration

Create and run a Prisma migration to add the FaceData model:

```bash
cd server
npx prisma migrate dev --name add_face_recognition
```

This will:
- Create the `face_data` table
- Add the `face_id` field to users
- Add `FACE_RECOGNITION` to the `AuthMethod` enum

### Step 2: Install Python Dependencies

Install the face recognition service:

```bash
cd face_recognition_service
# Create virtual environment (recommended)
python -m venv venv
source venv/Scripts/activate  # On Windows

# Install dependencies
pip install -r requirements.txt
```

**Note for Windows users**: You may need to install Visual C++ Build Tools if dlib fails to compile:
- Download from: https://visualstudio.microsoft.com/build-tools/
- Install "Desktop development with C++" workload

### Step 3: Install Node.js Dependencies

Update your Node.js backend to include the new controller:

```bash
cd server
npm install  # If not already done
```

### Step 4: Configure Environment Variables

**Backend (.env)**
```env
# Existing variables...

# Face Recognition Service
FACE_SERVICE_URL=http://localhost:5001
FACE_SERVICE_PORT=5001
```

**Python Service (face_recognition_service/.env)**
```env
FACE_SERVICE_PORT=5001
FACE_SERVICE_HOST=localhost
DEBUG_MODE=True  # Set to False in production
```

### Step 5: Update Middleware

Ensure your authentication middleware exists at `server/src/middlewares/auth.middleware.ts`:

```typescript
// Should export an authenticate middleware that sets req.user.id
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // Your existing auth logic
  // Set req.user = { id: userId, ... }
  next();
};
```

## Starting the Services

### Terminal 1: Start Python Face Recognition Service

```bash
cd face_recognition_service
python app.py
```

Output should show:
```
Starting Face Recognition Service on localhost:5001
WARNING in app.run_simple():
   Use a production WSGI server in a production deployment.
```

### Terminal 2: Start Node.js Backend

```bash
cd server
npm start
```

### Terminal 3: Start Next.js Frontend

```bash
cd front-end
npm run dev
```

## Integration Steps

### Step 1: Add Face Registration to Profile Settings

In your profile/settings component (`front-end/src/components/account/ProfileSettings.tsx` or similar):

```typescript
import FaceRegistrationModal from "@/components/auth/FaceRegistrationModal";
import { useFaceCheckStatus } from "@/hooks/useFaceRecognition";
import { Camera } from "lucide-react";

export function ProfileSettings() {
  const [showFaceModal, setShowFaceModal] = useState(false);
  const { faceRegistered, refetch: checkFaceStatus } = useFaceCheckStatus();

  return (
    <div className="space-y-6">
      {/* ... Other settings ... */}
      
      {/* Face Recognition Section */}
      <div className="border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Facial Recognition
          </h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            faceRegistered 
              ? "bg-green-100 text-green-800" 
              : "bg-gray-100 text-gray-800"
          }`}>
            {faceRegistered ? "Registered" : "Not Registered"}
          </span>
        </div>
        
        <p className="text-gray-600 mb-4">
          {faceRegistered
            ? "You can use your face to login to your account."
            : "Register your face to enable facial recognition login."}
        </p>
        
        <button
          onClick={() => setShowFaceModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {faceRegistered ? "Update Face" : "Register Face"}
        </button>
      </div>

      <FaceRegistrationModal
        isOpen={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        onSuccess={() => {
          setShowFaceModal(false);
          checkFaceStatus();
        }}
      />
    </div>
  );
}
```

### Step 2: Add Face Login Option to Login Page

In your login page (`front-end/src/components/auth/LoginPageContent.tsx` or similar):

```typescript
import FaceLoginModal from "@/components/auth/FaceLoginModal";
import { Camera } from "lucide-react";

export function LoginPageContent() {
  const [showFaceLogin, setShowFaceLogin] = useState(false);

  const handleFaceLoginSuccess = async (user: any) => {
    // Use NextAuth to sign in with the user data from face authentication
    const result = await signIn("face-credentials", {
      user_json: JSON.stringify(user),
      redirect: false,
    });

    if (result?.ok) {
      // Redirect to dashboard
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="space-y-4">
      {/* ... Existing login options ... */}

      {/* Face Login Option */}
      <button
        onClick={() => setShowFaceLogin(true)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
      >
        <Camera className="w-5 h-5" />
        Login with Face
      </button>

      <FaceLoginModal
        isOpen={showFaceLogin}
        onClose={() => setShowFaceLogin(false)}
        onSuccess={handleFaceLoginSuccess}
      />
    </div>
  );
}
```

### Step 3: Add NextAuth Provider Configuration

Update your NextAuth options in `front-end/src/app/api/auth/[...nextauth]/options.ts`:

```typescript
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: AuthOptions = {
  providers: [
    // ... existing providers ...

    // Face Recognition Provider
    CredentialsProvider({
      id: "face-credentials",
      name: "Face Recognition",
      credentials: {
        user_json: { label: "User", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.user_json) {
            throw new Error("No user data provided");
          }

          const user = JSON.parse(credentials.user_json);
          
          // Verify user exists in database
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          });

          if (!existingUser) {
            throw new Error("User not found");
          }

          return {
            id: String(existingUser.id),
            email: existingUser.email,
            name: existingUser.name,
            image: existingUser.image,
            provider: "face_recognition",
          };
        } catch (error) {
          console.error("[NextAuth Face] Authorization failed:", error);
          return null;
        }
      },
    }),
  ],
  // ... rest of config
};
```

## API Endpoints

### 1. Register Face
**POST** `/api/face/register`
- **Auth**: Required (bearer token)
- **Content-Type**: `multipart/form-data` or `application/octet-stream`
- **Body**: Image file or raw image bytes

**Response:**
```json
{
  "success": true|false,
  "message": "Human readable message",
  "error_code": "ERROR_CODE_IF_ANY"
}
```

### 2. Authenticate Face (Login)
**POST** `/api/face/authenticate`
- **Auth**: Not required
- **Content-Type**: `application/json`
- **Body**:
```json
{
  "email": "user@example.com",
  "imageData": "base64_encoded_image_string"
}
```

**Response:**
```json
{
  "success": true|false,
  "matched": true|false,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "User Name",
    "image": "url"
  },
  "message": "Human readable message",
  "error_code": "ERROR_CODE_IF_ANY",
  "debug_info": {
    "confidence": 0.95,
    "distance": 0.32
  }
}
```

### 3. Check Face Registration Status
**GET** `/api/face/check`
- **Auth**: Required

**Response:**
```json
{
  "success": true,
  "faceRegistered": true|false,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

### 4. Delete Face Data
**POST** `/api/face/delete`
- **Auth**: Required

**Response:**
```json
{
  "success": true,
  "message": "Face data removed successfully"
}
```

## Error Codes and Messages

| Error Code | Meaning | User Message |
|-----------|---------|--------------|
| `NO_FACE_DETECTED` | No face found in image | "No face detected. Ensure your face is clearly visible." |
| `MULTIPLE_FACES_DETECTED` | More than one face | "Only one face allowed per image." |
| `FACE_TOO_SMALL` | Face occupies <4% of image | "Move closer to camera (12-18 inches)." |
| `FACE_TOO_LARGE` | Face occupies >80% of image | "Move away from camera slightly." |
| `IMAGE_INVALID` | Bad/corrupted image | "Invalid image format." |
| `IMAGE_TOO_LARGE` | Image exceeds 5MB | "Image file is too large." |
| `ENCODING_FAILED` | Face encoding process failed | "Could not process your face." |
| `NO_MATCH_FOUND` | Face doesn't match stored encoding | "Face not recognized." |
| `SERVICE_UNAVAILABLE` | Python service not running | "Facial recognition service unavailable." |
| `DATABASE_ERROR` | Database operation failed | "Database error occurred." |

## Debugging

### Enable Debug Mode

**Python Service** (`.env`):
```env
DEBUG_MODE=True
```

Logs will show:
- Image processing steps
- Face detection results
- Encoding generation status
- Face distance and confidence values
- Error details with stack traces

### Common Issues

**Issue**: "No webcam detected"

**Solution**:
1. Check browser permissions: Settings → Privacy & Security → Camera
2. Ensure camera is not in use by another application
3. Try a different browser (Chrome recommended)
4. Restart browser and application

**Issue**: "No face detected" repeated

**Solution**:
1. Improve lighting (face should not be in shadow)
2. Clean camera lens
3. Move closer (12-18 inches optimal)
4. Remove glasses/masks/sunglasses if possible
5. Ensure face is fully visible and centered

**Issue**: "Face not recognized" during login

**Solution**:
1. Ensure similar lighting during registration and login
2. Keep similar head position and angle
3. Face should be larger in frame (30-50% of image)
4. Check camera quality (low-quality webcams may need retry)

**Issue**: Python service connection error

**Solution**:
1. Check if Python service is running: `http://localhost:5001/health`
2. Verify `FACE_SERVICE_URL` in backend `.env`
3. Check firewall isn't blocking port 5001
4. Ensure no other service is using port 5001

### Testing with cURL

**Test face registration**:
```bash
# Option 1: With image file
curl -X POST http://localhost:5001/api/face/register \
  --data-binary @image.jpg \
  -H "Content-Type: application/octet-stream"

# Option 2: Check service health
curl http://localhost:5001/health
```

**Test authentication**:
```bash
curl -X POST http://localhost:5001/api/face/authenticate \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "image": "base64_image_string_here",
  "encoding": [128 float values]
}
EOF
```

## Performance Notes

- **Registration**: 2-3 seconds per image
- **Authentication**: 2-3 seconds per attempt
- **Memory**: Python service uses ~200-300 MB RAM
- **CPU**: Moderate usage, scales with image resolution
- **Latency**: ~30ms network + ~2500ms processing

For production deployments with high traffic, consider:
- Running Python service on separate server
- Using GPU acceleration (NVIDIA CUDA)
- Implementing caching for face encodings
- Load balancing across multiple service instances

## Security Considerations

### Data Protection

1. **Face Encodings**: 
   - Stored in PostgreSQL with encryption at rest (enable in production)
   - Never transmit over unencrypted channels (use HTTPS)
   - 128-dimensional vectors (not reversible to original image)

2. **Database Security**:
   - Enable column-level encryption for `face_data` table
   - Use strong authentication for database access
   - Regular backups with encryption

3. **API Security**:
   - Implement rate limiting on face endpoints
   - Add CSRF protection
   - Validate all inputs
   - Use HTTPS in production

4. **Webcam Access**:
   - Browser requests camera permission (user must allow)
   - Only accessed during registration/login
   - Cleaned up immediately after use

### Recommended Production Setup

```env
# Production .env
FACE_SERVICE_URL=https://face-service.example.com  # Use HTTPS
FACE_SERVICE_PORT=443

# Backend
DATABASE_ENCRYPTION=true  # Enable postgres encryption
RATE_LIMIT_FACE_AUTH=5  # Max 5 attempts per minute
```

## Future Enhancements

The current implementation supports basic face recognition. Future enhancements could include:

- **Liveness Detection**: Prevent spoofing with phone images or photos
- **Multiple Face Enrollment**: Register multiple face angles for better accuracy
- **Progressive Learning**: Improve recognition over time with new captures
- **GPU Acceleration**: Use NVIDIA CUDA for faster processing
- **Behavioral Biometrics**: Add gait, typing patterns, etc.
- **3D Face Recognition**: More robust against variations
- **Spoofing Detection**: Detect presentation attacks (photo, video, mask)

## Support and Troubleshooting

For issues or questions:

1. Check the browser console for frontend errors
2. Review Python service logs for detection failures
3. Check Node.js backend logs for API errors
4. Use debug info in error responses
5. Test individual components (webcam, backend API)

## License and Attribution

This facial recognition system uses:
- **face_recognition**: MIT License (created by Adam Geitgey)
- **OpenCV**: Apache 2.0 License
- **dlib**: Boost Software License

All code provided as-is for your BillSutra application.
