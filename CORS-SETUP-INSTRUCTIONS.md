# S3 CORS Configuration Instructions

## Current Status

✅ **IAM Permissions**: Fixed - S3 upload permissions are working correctly
❌ **CORS Configuration**: Needs to be applied via AWS Console

## Why CORS is Needed

The frontend uploads files directly to S3 using presigned URLs. Without proper CORS configuration, browsers will block these uploads with CORS errors.

## How to Apply CORS Configuration

### Option 1: AWS Console (Recommended)

1. **Go to S3 Console**
   - Open https://s3.console.aws.amazon.com/s3/buckets
   - Sign in to AWS account: `496488677098`

2. **Navigate to Your Bucket**
   - Click on bucket: `koda-user-file`

3. **Edit CORS Configuration**
   - Click the "Permissions" tab
   - Scroll down to "Cross-origin resource sharing (CORS)"
   - Click "Edit"

4. **Paste This Configuration**

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "https://koda-frontend.ngrok.app",
            "http://localhost:3000",
            "https://*.ngrok.app",
            "https://*.ngrok-free.dev"
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

5. **Save Changes**
   - Click "Save changes"
   - Wait a few seconds for the configuration to propagate

### Option 2: Using AWS CLI (If Installed)

If you have AWS CLI installed and configured:

```bash
aws s3api put-bucket-cors --bucket koda-user-file --cors-configuration file://cors.json --region us-east-2
```

## What This CORS Configuration Does

- **AllowedOrigins**: Permits requests from your frontend domains
  - Production: `https://koda-frontend.ngrok.app`
  - Development: `http://localhost:3000`
  - All ngrok domains: `https://*.ngrok.app`, `https://*.ngrok-free.dev`

- **AllowedMethods**: Permits these HTTP methods
  - `PUT`: For uploading files
  - `GET`: For downloading files
  - `POST`, `DELETE`, `HEAD`: For other operations

- **AllowedHeaders**: `*` allows all headers (necessary for presigned URLs)

- **ExposeHeaders**: Makes S3 response headers accessible to JavaScript
  - `ETag`: File version identifier
  - `x-amz-*`: AWS-specific headers

- **MaxAgeSeconds**: Browser caches CORS preflight for 50 minutes (3000 seconds)

## Testing After CORS Configuration

After applying CORS:

1. Refresh your frontend: `https://koda-frontend.ngrok.app`
2. Try uploading files again
3. Files should upload successfully without CORS errors

## Troubleshooting

If uploads still fail after applying CORS:

1. **Wait 1-2 minutes** for AWS to propagate the CORS configuration
2. **Hard refresh** the frontend (Ctrl+Shift+R or Cmd+Shift+R)
3. **Check browser console** for any remaining errors
4. **Verify CORS was applied**: In S3 Console → Permissions → CORS should show your configuration

## Files Summary

- ✅ `cors.json` - CORS configuration file (already created in project root)
- ✅ IAM Permissions - Fixed (changed `koda-user-files` → `koda-user-file`)
- ✅ Backend bucket name - Fixed in `s3Storage.service.ts`
- ❌ S3 Bucket CORS - **Needs to be applied via AWS Console**

## Next Steps

1. Apply CORS configuration to S3 bucket (see instructions above)
2. Test file uploads from frontend
3. If successful, uploads should complete and documents will be processed in the background
