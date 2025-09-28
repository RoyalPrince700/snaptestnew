# Vercel Deployment Guide

This project is configured for deployment on Vercel with both frontend and backend.

## Project Structure

- `frontend/` - React + Vite application
- `backend/` - Node.js + Express API server
- `vercel.json` - Root Vercel configuration for monorepo deployment

## Deployment Options

### Option 1: Monorepo Deployment (Recommended)

Deploy the entire project as one Vercel project:

1. Connect your repository to Vercel
2. Vercel will automatically detect the `vercel.json` configuration
3. Set environment variables in Vercel dashboard:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `FRONTEND_URL` (your Vercel domain)
   - Any other environment variables your app needs

### Option 2: Separate Deployments

Deploy frontend and backend as separate Vercel projects:

**Frontend Deployment:**
- Use the `frontend/` directory
- Vercel will use `frontend/vercel.json`
- Set `VITE_API_URL` to your backend Vercel URL

**Backend Deployment:**
- Use the `backend/` directory
- Vercel will use `backend/vercel.json`
- Configure all backend environment variables

## Environment Variables

Required environment variables for backend:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your_jwt_secret_key_here
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

## Important Notes

1. The backend is configured to work as a serverless function on Vercel
2. All API routes are prefixed with `/api/`
3. Static files are served from the frontend build
4. Database connections use MongoDB Atlas (recommended for serverless)

## Build Commands

- Frontend: `npm run build` (outputs to `dist/`)
- Backend: Uses serverless function deployment

## CORS Configuration

Update the `FRONTEND_URL` in your backend environment variables to match your Vercel domain after deployment.
