# Google Cloud Setup Guide

## Step-by-Step Instructions

### 1. Find Your Project ID
1. Go to: https://console.cloud.google.com
2. Look at the top navigation bar
3. Click the project dropdown
4. Copy your **Project ID** (not the name!)

Example: `koda-app-123456` or `my-project-2024`

---

### 2. Enable Required APIs

Visit these links (they'll auto-select your project):

**Cloud Vision API:**
https://console.cloud.google.com/apis/library/vision.googleapis.com
- Click **ENABLE**

**Cloud Storage API:**
https://console.cloud.google.com/apis/library/storage-api.googleapis.com
- Click **ENABLE** (might already be enabled)

---

### 3. Create Storage Bucket

1. Go to: https://console.cloud.google.com/storage/browser
2. Click **CREATE BUCKET**
3. **Bucket name**: `koda-documents-dev` (or any unique name)
4. **Location type**: Region or Multi-region (choose closest to you)
5. **Storage class**: Standard
6. **Access control**: Uniform
7. Click **CREATE**

Copy the bucket name you chose!

---

### 4. Create Service Account

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click **CREATE SERVICE ACCOUNT**
3. Fill in:
   - **Name**: `koda-backend`
   - **Description**: `Backend service for Koda document processing`
4. Click **CREATE AND CONTINUE**

---

### 5. Grant Permissions

Add these 2 roles:

1. Click **SELECT A ROLE** dropdown
2. Search for: `Storage Object Admin`
3. Click it to add
4. Click **ADD ANOTHER ROLE**
5. Search for: `Cloud Vision API User`
6. Click it to add
7. Click **CONTINUE** → **DONE**

---

### 6. Create and Download JSON Key

1. Click on the service account you just created (koda-backend)
2. Click the **KEYS** tab
3. Click **ADD KEY** → **Create new key**
4. Choose **JSON**
5. Click **CREATE**
6. A file will download (e.g., `koda-app-123456-a1b2c3d4e5f6.json`)

---

### 7. Move JSON File to Backend Folder

**Windows (PowerShell):**
```powershell
# Replace with your actual filename
Move-Item ~\Downloads\your-project-*.json C:\Users\Pedro\desktop\webapp\backend\gcp-service-account.json
```

**Windows (Command Prompt):**
```cmd
move "%USERPROFILE%\Downloads\your-project-*.json" "C:\Users\Pedro\desktop\webapp\backend\gcp-service-account.json"
```

---

### 8. Update .env File

Open `backend/.env` and update these lines:

```bash
# Replace with YOUR actual values:
GCS_PROJECT_ID=your-actual-project-id        # From step 1
GCS_BUCKET_NAME=koda-documents-dev           # From step 3
GCS_KEY_FILE=./gcp-service-account.json      # Should already be this
```

**Example:**
```bash
GCS_PROJECT_ID=koda-app-123456
GCS_BUCKET_NAME=koda-documents-dev
GCS_KEY_FILE=./gcp-service-account.json
```

---

### 9. Test the Connection

```bash
cd backend
node test-vision-api.js
```

**Expected output:**
```
✅ Vision API connected successfully!
🎉 Google Cloud Vision API is ready to use!
```

---

### 10. Revoke Your Exposed API Key

**IMPORTANT:** Since you shared your API key publicly, delete it:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find the API key: `AIzaSyCQ5cEZZG-zrog4r8wf7U5X32mQ3YFqUtc`
3. Click the **⋮** (three dots) → **Delete**
4. Confirm deletion

You don't need that API key anymore - the service account handles everything!

---

## Checklist

- [ ] Found my Project ID
- [ ] Enabled Cloud Vision API
- [ ] Enabled Cloud Storage API
- [ ] Created a GCS bucket
- [ ] Created service account with 2 roles
- [ ] Downloaded JSON key file
- [ ] Moved JSON file to backend folder as `gcp-service-account.json`
- [ ] Updated .env with correct PROJECT_ID and BUCKET_NAME
- [ ] Tested with `node test-vision-api.js` ✅
- [ ] Deleted exposed API key

---

## Need Help?

### Error: "Could not load credentials"
- Make sure `gcp-service-account.json` exists in backend folder
- Check that GCS_KEY_FILE=./gcp-service-account.json in .env

### Error: "API not enabled"
- Go back to step 2 and enable the APIs

### Error: "Permission denied"
- Go back to step 5 and make sure both roles are added

### Error: "Bucket not found"
- Check that GCS_BUCKET_NAME in .env matches your actual bucket name

---

## What Each File Does

| File/Setting | Purpose |
|-------------|---------|
| `gcp-service-account.json` | Your server's credentials (like a password) |
| `GCS_PROJECT_ID` | Which Google Cloud project to use |
| `GCS_BUCKET_NAME` | Where to store uploaded files |
| Service Account Roles | What the server is allowed to do |

---

## Quick Reference Commands

```bash
# Test Vision API
node test-vision-api.js

# Start backend
npm run dev

# Check if JSON file exists
dir gcp-service-account.json

# View your .env (check values)
type .env
```
