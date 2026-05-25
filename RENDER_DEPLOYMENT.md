# 🚀 Render Deployment Guide - Season Reservas

## Problem & Solution

### ❌ Current Issue
The application is deployed on Render but the `/api/tables` endpoint returns an error because **DATABASE_URL is not configured**.

The `render.yaml` declares `DATABASE_URL` with `sync: false`, meaning it must be set manually in the Render dashboard.

### ✅ Solution
Configure a free PostgreSQL database using Supabase (free tier) and add the connection string to Render.

---

## Step 1: Create Free PostgreSQL Database (Supabase)

### 1.1 Sign Up
1. Go to https://supabase.com
2. Click "Sign Up"
3. Use GitHub or email to create account

### 1.2 Create New Project
1. Click "New Project"
2. Fill in:
   - **Project Name**: `season-reservas`
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Select closest to your location
3. Click "Create new project" (wait ~2 minutes)

### 1.3 Get Connection String
1. In Supabase dashboard, go to: **Settings** → **Database** → **Connection Pooling**
2. Click on **Connection string** tab
3. Select **URI** (not JSON)
4. Copy the full string (looks like):
```
postgresql://postgres.xxxxx:PASSWORD@db.xxxxx.supabase.co:6543/postgres
```
5. Replace `PASSWORD` with the password you created
6. Keep this string, you'll need it next

---

## Step 2: Configure Environment Variables in Render

### 2.1 Go to Render Dashboard
1. Open https://dashboard.render.com
2. Click on your `season-reservas` service

### 2.2 Add Environment Variables
1. Click on **Environment** (in left sidebar)
2. Click **Add Environment Variable** for each:

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | Your Supabase URI | `postgresql://postgres...` |
| `SECRET_KEY` | A random secret | Generate with: `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `TWILIO_ACCOUNT_SID` | (optional - leave empty if not using WhatsApp) | `ACxxxxxx` |
| `TWILIO_AUTH_TOKEN` | (optional - leave empty if not using WhatsApp) | `your_token` |
| `TWILIO_WHATSAPP_NUMBER` | (optional - leave empty if not using WhatsApp) | `whatsapp:+1234567890` |

### 2.3 Save Variables
Click **Save Changes** after adding each variable.

---

## Step 3: Redeploy on Render

After adding environment variables, trigger a new deployment:

### Option A: Automatic Redeploy (Recommended)
```bash
cd /path/to/proyecto\ reservas\ Season
git add -A
git commit -m "Config: DATABASE_URL configured in Render"
git push origin main
```
Render will automatically redeploy. Check progress in Render dashboard.

### Option B: Manual Redeploy
1. In Render dashboard, click **Manual Deploy**
2. Wait for build to complete (~3-5 minutes)

---

## Step 4: Verify Deployment

### 4.1 Health Check
```bash
curl https://season-reservas.onrender.com/api/health
```

**Expected response:**
```json
{"status":"healthy","timestamp":"2026-05-25 20:03:25"}
```

### 4.2 Tables Endpoint
```bash
curl https://season-reservas.onrender.com/api/tables
```

**Expected response:** JSON array with 33 restaurant tables

### 4.3 Open Application
Open in browser: https://season-reservas.onrender.com

---

## Troubleshooting

### ❌ Error: "DATABASE_URL environment variable is required"
**Cause**: DATABASE_URL not set in Render
**Fix**:
1. Go to Render dashboard → Environment
2. Verify DATABASE_URL is there
3. Click Deploy manually

### ❌ Error: "SQLALCHEMY_DATABASE_URI" or "could not translate host name"
**Cause**: Invalid PostgreSQL connection string
**Fix**:
1. Verify the full Supabase URI is correct
2. Make sure PASSWORD is filled in
3. Check that the URI starts with `postgresql://`

### ❌ Tables endpoint returns empty array
**Cause**: Database tables haven't been created yet
**Fix**:
1. Application creates tables automatically on first request
2. Make 2-3 requests to trigger initialization
3. Wait 5 seconds between requests
4. Check Render logs for errors: **Logs** tab in dashboard

### ❌ Application takes too long to respond
**Cause**: Cold start on first request (database initialization)
**Fix**:
1. First request takes ~3-5 seconds
2. Subsequent requests are fast (<500ms)
3. This is normal for serverless apps

---

## Monitoring & Logs

### View Application Logs
1. In Render dashboard, click **Logs** tab
2. Search for errors or warnings
3. Look for: ✅ Database init error, ❌ connection errors

### Check Database
1. Go to Supabase dashboard
2. Click on your project
3. Go to **SQL Editor**
4. Run:
```sql
SELECT COUNT(*) FROM public.table;
```

Should return: `33` (if tables were created)

---

## Cost Breakdown

| Service | Cost | Free Tier |
|---------|------|-----------|
| **Render (Web Service)** | $25/month | No |
| **Supabase PostgreSQL** | Pay-as-you-go | 500MB free |
| **Total** | **$25/month** | ✅ Very affordable |

---

## Next Steps

### 1. Verify Everything Works
- [ ] Database configured in Render
- [ ] Application deployed successfully
- [ ] `/api/health` endpoint works
- [ ] `/api/tables` returns data
- [ ] Dashboard loads in browser

### 2. Test Features
- [ ] Create a new reservation
- [ ] Update reservation
- [ ] Delete reservation
- [ ] Floor plan shows updated tables

### 3. (Optional) Configure WhatsApp
If you want WhatsApp notifications:
1. Create Twilio account
2. Set up WhatsApp number
3. Add TWILIO_* environment variables to Render
4. Test WhatsApp integration

---

## Advanced: Local Development Setup

To develop locally with the same PostgreSQL database:

### 1. Create .env file
```bash
cp .env.example .env
```

### 2. Edit .env with your Supabase URL
```env
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
FLASK_ENV=development
SECRET_KEY=your-dev-secret
```

### 3. Initialize database
```bash
chmod +x setup_db.sh
./setup_db.sh
```

### 4. Run application
```bash
python run.py
```

Open http://localhost:3000 in browser.

---

## Git Workflow

Always deploy changes through GitHub:

```bash
# 1. Make changes locally
git add .
git commit -m "Feature: Description"

# 2. Push to GitHub
git push origin main

# 3. Render auto-deploys
# Monitor in dashboard: https://dashboard.render.com

# 4. Verify in production
curl https://season-reservas.onrender.com/api/health
```

**Never push database credentials to GitHub!** Use Render environment variables instead.

---

## Contact & Support

- **Application**: https://season-reservas.onrender.com
- **Render Dashboard**: https://dashboard.render.com
- **Supabase Dashboard**: https://app.supabase.com
- **Documentation**: See DEPLOYMENT_SETUP.md

