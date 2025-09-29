# Render Backend Deployment Guide

This guide will help you deploy your SnapTest backend to Render.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. Your MongoDB Atlas connection string
3. Your API keys (JWT_SECRET, FIREWORKS_API_KEY)

## Step 1: Prepare Your Backend Code

### 1.1 Update CORS Configuration

Update the `allowedOrigins` array in `backend/server.js` with your actual Render URL:

```javascript
const allowedOrigins = [
  "http://localhost:5173",               // Vite local dev
  "https://snaptestnew-vn9a.vercel.app", // frontend live (Vercel)
  "https://your-app-name.onrender.com"   // Replace with your actual Render URL
];
```

**Note:** You can update this after deployment with your actual Render URL.

### 1.2 Verify Package.json

Your `backend/package.json` should have:
- `"start": "node server.js"` script
- All necessary dependencies listed

## Step 2: Deploy to Render

### 2.1 Connect Your Repository

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub/GitLab repository
4. Select your repository

### 2.2 Configure Build Settings

**Basic Settings:**
- **Name:** Choose a name for your service (e.g., `snaptest-backend`)
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

**Advanced Settings:**
- **Environment:** `Production`
- **Region:** Choose the closest region to your users
- **Instance Type:** `Free` (for testing) or paid plans for production

### 2.3 Configure Environment Variables

Add these environment variables in the "Environment" section:

```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://finetex700_db_user:Adegoes2school@snaptest.gcvsexb.mongodb.net/snaptest?retryWrites=true&w=majority&appName=snaptest
JWT_SECRET=fkg78hyvyhfgvI7kdT7D57TGI56df7IT553rd468dd4S3RTx34YI68yvjht67ct6cVTCRTRFYIYdfuy685i86
FIREWORKS_API_KEY=fw_3ZdMmRNvi8dMBcG1uYvw9tDe
JWT_EXPIRE=7d
```

**Security Note:** Never commit these values to your repository. Always use Render's environment variable configuration.

### 2.4 Deploy

1. Click "Create Web Service"
2. Wait for the build and deployment to complete
3. Note your service URL (e.g., `https://snaptest-backend.onrender.com`)

## Step 3: Update Frontend Configuration

### 3.1 Update API Base URL

In your frontend `src/services/api.js`, update the `API_BASE_URL`:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://your-app-name.onrender.com/api'
```

Replace `your-app-name` with your actual Render service name.

### 3.2 Update CORS (if needed)

In `backend/server.js`, update the CORS configuration with your actual Render URL:

```javascript
const allowedOrigins = [
  "http://localhost:5173",
  "https://snaptestnew-vn9a.vercel.app",
  "https://your-app-name.onrender.com"  // Your actual Render URL
];
```

## Step 4: Test Your Deployment

1. **Test Health Check:**
   ```
   curl https://your-app-name.onrender.com/api/health
   ```

2. **Test Login:**
   - Try logging in through your frontend
   - Check browser Network tab for successful API calls

3. **Test File Upload:**
   - Try uploading a document after logging in
   - Verify the ingestion process works

## Troubleshooting

### Common Issues:

1. **Port Configuration:**
   - Render automatically assigns a port via `PORT` environment variable
   - Your code already handles this with `process.env.PORT || 5000`

2. **Database Connection:**
   - Ensure your MongoDB Atlas IP whitelist includes `0.0.0.0/0` (all IPs)
   - Verify the connection string is correct

3. **Environment Variables:**
   - Double-check all required environment variables are set in Render
   - Ensure no typos in variable names

4. **CORS Issues:**
   - Update the `allowedOrigins` array with your exact Render URL
   - Include protocol (`https://`) and no trailing slash

### Logs and Debugging:

- Check Render service logs in the dashboard
- Use browser Developer Tools to inspect network requests
- Test API endpoints directly with tools like Postman

## Performance Optimization

### Free Tier Considerations:
- Free tier has a 15-minute inactivity timeout
- First request after timeout may be slow (cold start)
- Consider upgrading to paid plans for better performance

### Environment Variables for Production:
```
NODE_ENV=production
JWT_EXPIRE=7d
# Add any other production-specific variables
```

## Security Best Practices

1. **Keep API Keys Secure:**
   - Never commit secrets to version control
   - Use Render's environment variable system
   - Rotate keys regularly

2. **Database Security:**
   - Use strong database passwords
   - Restrict IP access in MongoDB Atlas
   - Enable database authentication

3. **CORS Configuration:**
   - Only allow necessary origins
   - Use specific domains instead of wildcards

## Updating Your Deployment

To deploy updates:
1. Push changes to your repository
2. Render will automatically rebuild and deploy
3. Monitor the deployment logs for any issues

## Cost Optimization

- **Free Tier:** Suitable for development/testing
- **Paid Plans:** Starting at $7/month for better performance
- Monitor usage in Render dashboard
- Consider usage-based pricing for variable traffic

---

**Need Help?** Check Render's documentation at https://docs.render.com/ or contact their support.
