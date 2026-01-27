# Supabase Setup Guide

## Option 1: Use Supabase Cloud (Recommended for Production)

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in project details:
   - **Name:** invoice-automation
   - **Database Password:** (generate a strong password)
   - **Region:** Choose closest to your location
5. Wait for project to be created (~2 minutes)

### Step 2: Get API Keys

1. In your project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

### Step 3: Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `supabase/schema.sql`
4. Paste into the SQL editor
5. Click **Run** (⌘ + Enter)
6. Verify tables were created in **Table Editor**

### Step 4: Update Environment Variables

1. In your project root: `cp .env.local.example .env.local`
2. Edit `.env.local` and paste your keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

3. Restart your dev server: `npm run dev`

---

## Option 2: Use Local Supabase (Development)

### Prerequisites

- Docker installed and running
- Supabase CLI installed: `npm install -g supabase`

### Steps

1. **Initialize Supabase locally:**

   ```bash
   cd invoice-app
   supabase init
   supabase start
   ```

2. **Get local credentials:**
   After `supabase start`, you'll see output with:
   - API URL
   - anon key
   - service_role key

3. **Apply schema:**

   ```bash
   supabase db reset
   # Or manually in SQL editor
   ```

4. **Update `.env.local`:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
   ```

---

## Option 3: Skip Supabase for Now (Demo Mode)

If you want to skip database setup temporarily:

1. Comment out Supabase imports in API routes
2. Use in-memory storage or mock data
3. Files will still be stored locally in `uploads/` directory

---

## Verify Setup

1. Start dev server: `npm run dev`
2. Go to http://localhost:3000/upload
3. Upload a PDF file
4. Check:
   - File appears in processing queue
   - In Supabase dashboard → Table Editor → `jobs` table
   - File stored in `uploads/` folder

---

## Troubleshooting

### "Missing Supabase environment variables"

- Make sure `.env.local` exists with all required variables
- Restart dev server after changing environment variables

### "Failed to connect to Supabase"

- Check project URL is correct (no trailing slash)
- Verify anon key is the public key, not service role key
- For local setup, ensure Docker and Supabase are running

### "Permission denied" or RLS errors

- The schema includes permissive RLS policies for development
- In production, you'll need to add proper user authentication

---

## Next Steps

Once Supabase is set up:

- ✅ Upload files via drag-and-drop
- ✅ Files are stored in database
- ✅ View jobs in `/jobs` page
- 🔜 Next: Add OCR extraction pipeline
