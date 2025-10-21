# Setup Guide

This is a quick guide to get the job search app running locally.

## What you need

- Node.js (version 18 or higher)
- A Supabase account
- OpenAI API key

## Step 1: Install dependencies

```bash
npm install
```

## Step 2: Set up Supabase

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project
3. Go to Settings → Database and copy the connection string
4. Go to Settings → API and copy the anon key

## Step 3: Get OpenAI API key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Add some credits (embeddings are really cheap, $5-10 is plenty)

## Step 4: Environment variables

Create a `.env` file in the root directory:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# OpenAI
OPENAI_API_KEY=sk-your-key-here

# API
PORT=3000

# Frontend
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Step 5: Database setup

```bash
npm run db:generate
npm run db:push
```

## Step 6: Add some test data (optional)

```bash
npm run crawl
```

This will scrape some jobs from GitHub and add them to your database.

## Step 7: Start the app

```bash
npm run dev
```

Then visit:
- Frontend: http://localhost:5173
- API: http://localhost:3000

## Common problems

**"Cannot connect to database"**
- Check your DATABASE_URL in `.env`
- Make sure you replaced the password in the connection string

**"OpenAI API error"**
- Verify your API key is correct
- Check you have credits in your OpenAI account

**"Port already in use"**
- Change PORT in `.env` to 3001
- Update VITE_API_URL to match

## What's next

Once it's running, you can:
- Add more job sources by modifying the crawlers
- Customize the UI
- Add authentication
- Deploy to Vercel

The app should work out of the box with the basic setup above.