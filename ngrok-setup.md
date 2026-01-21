# Ngrok Setup Guide for FosssilProcure

This guide will help you expose your local development server to the internet using ngrok.

## What is ngrok?

ngrok creates secure tunnels to localhost, allowing you to:
- Test webhooks from external services
- Share your local development server with others
- Test on mobile devices
- Access your app from anywhere

## Prerequisites

1. **Install ngrok**:
   - Visit https://ngrok.com/download
   - Download the Windows version
   - Extract ngrok.exe to a folder (e.g., `C:\ngrok\`)
   - Add it to your PATH or use the full path

2. **Sign up for a free ngrok account** (optional but recommended):
   - Visit https://dashboard.ngrok.com/signup
   - Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
   - Run: `ngrok config add-authtoken YOUR_AUTHTOKEN`

## Setup Instructions

### Option 1: Tunnel Both API and Frontend Separately

**Terminal 1 - API Tunnel (Port 3001):**
```bash
ngrok http 3001
```

**Terminal 2 - Frontend Tunnel (Port 5173):**
```bash
ngrok http 5173
```

### Option 2: Use the Helper Scripts

We've created npm scripts to make this easier. See `package.json` for details.

## Environment Variables

Once ngrok is running, you'll get URLs like:
- API: `https://xxxx-xxxx-xxxx.ngrok-free.app` (or similar)
- Frontend: `https://yyyy-yyyy-yyyy.ngrok-free.app` (or similar)

Update your `.env` file in the `api` directory:

```env
# Update CLIENT_URL with your ngrok frontend URL
CLIENT_URL=https://yyyy-yyyy-yyyy.ngrok-free.app

# Your API will be accessible via ngrok URL
# Make sure CORS is configured to allow the ngrok frontend URL
```

### CORS Configuration

The server automatically allows ngrok URLs in development mode, so no additional CORS configuration is needed. The server will:
- Allow `http://localhost:5173` by default
- Allow any URL from `CLIENT_URL` environment variable
- Automatically allow any URL containing "ngrok" in development mode

## Important Notes

1. **Free tier limitations**:
   - URLs change every time you restart ngrok (unless you use a static domain with a paid plan)
   - Session timeout after 2 hours of inactivity

2. **Security**:
   - Your local server will be accessible to anyone with the ngrok URL
   - Only use for development/testing
   - Never expose production environments

3. **Email notifications**:
   - Email links will use your `CLIENT_URL` environment variable
   - Update it with the ngrok frontend URL for proper email links

4. **API base URL**:
   - The frontend uses relative URLs (`/api`), so it should work automatically
   - If you need absolute URLs, you can configure the API base URL

## Troubleshooting

- **Connection refused**: Make sure your local servers are running first
- **CORS errors**: Update CORS settings to include your ngrok frontend URL
- **Webhook issues**: Use the ngrok API URL for webhook endpoints
- **URL changes**: Free ngrok URLs change on restart. Use a static domain with paid plans

## Quick Start Commands

### Method 1: Using Helper Scripts (Windows)

1. Start your local servers:
   ```bash
   npm run dev
   ```

2. In separate PowerShell/Command Prompt windows, run:
   ```bash
   # PowerShell - API
   .\scripts\start-ngrok-api.ps1
   
   # Or Command Prompt - API
   scripts\start-ngrok-api.bat
   
   # PowerShell - Frontend
   .\scripts\start-ngrok-frontend.ps1
   
   # Or Command Prompt - Frontend
   scripts\start-ngrok-frontend.bat
   ```

3. Copy the ngrok URLs and update your `.env` file

4. Restart your API server to pick up the new environment variables

### Method 2: Manual Commands

1. Start your local servers:
   ```bash
   npm run dev
   ```

2. In separate terminals, start ngrok:
   ```bash
   # Terminal 1 - API
   ngrok http 3001

   # Terminal 2 - Frontend
   ngrok http 5173
   ```

3. Copy the ngrok URLs and update your `.env` file

4. Restart your API server to pick up the new environment variables

### Using the Ngrok URLs

- **Frontend URL**: Access your app at the ngrok frontend URL (e.g., `https://xxxx-yyyy.ngrok-free.app`)
- **API URL**: If both frontend and API are on different ngrok URLs, you'll need to configure the frontend to use the API ngrok URL (see below)
- **Email Links**: Will use your `CLIENT_URL` environment variable

### Important: Frontend API Configuration

If you're tunneling both frontend and API separately, the frontend needs to know where the API is:

**Option 1: Use environment variable** (already configured in code):
The frontend already supports `VITE_API_URL` environment variable. Just create/update `client/.env`:
```env
VITE_API_URL=https://your-api-ngrok-url.ngrok-free.app/api
```

Then restart your frontend dev server. The API will use this URL instead of the relative `/api` path.

**Option 2: Use a single ngrok tunnel** (recommended for testing):
- Only tunnel the frontend (port 5173)
- Keep API on localhost (port 3001)
- Frontend will use `/api` which points to localhost (won't work from external devices)

**Option 3: Use a reverse proxy** (advanced):
- Tunnel only the frontend
- Configure Vite to proxy `/api` requests to `http://localhost:3001`

