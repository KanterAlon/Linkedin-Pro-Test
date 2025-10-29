# Vercel Deployment Guide

## Pre-Deployment Checklist

✅ **Completed Preparations:**
- Removed `--turbopack` flag from build script
- Created `.env.example` for environment variable reference
- Created `vercel.json` configuration file
- Verified Next.js 15 compatibility with Vercel

## Deployment Steps

### 1. Push to Git Repository

Make sure your code is pushed to a Git repository (GitHub, GitLab, or Bitbucket):

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Import Project to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New..." → "Project"
3. Import your Git repository
4. Vercel will auto-detect Next.js framework

### 3. Configure Environment Variables

In the Vercel project settings, add these environment variables:

#### Required Variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Your Clerk publishable key
- `CLERK_SECRET_KEY` - Your Clerk secret key
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `NEXT_PUBLIC_APP_URL` - Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

#### Optional Variables:

- `POLLINATIONS_API_TOKEN` - For enhanced AI content generation

**Important:** After deployment, update `NEXT_PUBLIC_APP_URL` with your actual Vercel URL and redeploy.

### 4. Configure Clerk

1. Go to your Clerk dashboard
2. Add your Vercel domain to allowed origins:
   - Development: `https://your-app.vercel.app`
   - Production: Your custom domain (if applicable)
3. Update redirect URLs in Clerk settings

### 5. Deploy

Click "Deploy" in Vercel. The build process will:
- Install dependencies with `npm install`
- Build the project with `npm run build`
- Deploy to Vercel's edge network

## Post-Deployment

### Verify Deployment

1. Check that the build completed successfully
2. Visit your deployed URL
3. Test authentication with Clerk
4. Upload a LinkedIn PDF to verify the full flow

### Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed by Vercel
4. Update `NEXT_PUBLIC_APP_URL` environment variable
5. Update Clerk allowed origins

## Troubleshooting

### Build Failures

- **Missing environment variables:** Ensure all required variables are set in Vercel
- **TypeScript errors:** Run `npm run build` locally first to catch issues
- **Dependency issues:** Check that all dependencies are in `package.json`

### Runtime Issues

- **Authentication not working:** Verify Clerk keys and allowed origins
- **Database connection failed:** Check Supabase credentials
- **API routes timing out:** Vercel has a 10-second timeout for Hobby plan (60s for Pro)

### Logs

View deployment and runtime logs in:
- Vercel Dashboard → Your Project → Deployments → [Select deployment] → Logs

## Performance Optimization

Consider these optimizations for production:

1. **Enable caching** for static assets
2. **Configure ISR** (Incremental Static Regeneration) for profile pages
3. **Add image optimization** if using images
4. **Monitor with Vercel Analytics** (optional)

## Continuous Deployment

Vercel automatically deploys:
- **Production:** Commits to `main` branch
- **Preview:** Pull requests and other branches

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Clerk Vercel Integration](https://clerk.com/docs/deployments/deploy-to-vercel)
