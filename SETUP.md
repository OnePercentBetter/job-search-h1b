# Quick Setup Guide

Follow these steps to get your job search app running this weekend!

## ⚡ 5-Minute Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase (Easiest Option)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings → Database and copy the connection string
4. Go to Settings → API and copy the `anon` public key

### 3. Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Add $5-10 credits (embeddings are very cheap)

### 4. Create `.env` File

Create a file called `.env` in the root directory:

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx

# API Config
PORT=3000

# Frontend Config
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Set Up Database

```bash
# Enable pgvector extension (Supabase has it pre-installed)
npm run db:generate

# Push schema to database
npm run db:push
```

### 6. Seed Some Jobs (Optional)

```bash
npm run crawl
```

This will add some test jobs to your database.

### 7. Start Development!

```bash
npm run dev
```

Visit:
- Frontend: http://localhost:5173
- API: http://localhost:3000

## 🎯 Weekend Build Timeline

### Saturday Morning (3 hours)
- ✅ You've already scaffolded the project!
- Set up Supabase and get API keys
- Run database migrations
- Verify everything runs locally

### Saturday Afternoon (3-4 hours)
- Customize the GitHub crawler to scrape real jobs
- Test vector search with your profile description
- Add more job sources if time permits

### Sunday Morning (3 hours)
- Implement Supabase Auth (replace placeholder auth)
- Polish the UI
- Fix any bugs

### Sunday Afternoon (2-3 hours)
- Test with a real user (yourself!)
- Deploy to Vercel
- Share with your first test user

## 📝 Critical Files to Understand

1. **apps/api/src/db/schema.ts** - Database structure
2. **apps/api/src/routes/jobs.ts** - Job search API
3. **apps/web/src/pages/Dashboard.tsx** - Main UI
4. **scripts/crawlers/github-jobs.ts** - Job scraping logic

## 🚨 Common Issues

### "Cannot connect to database"
- Double-check your DATABASE_URL in `.env`
- Make sure you replaced `[YOUR-PASSWORD]` with your actual Supabase password

### "OpenAI API error"
- Verify your API key is correct
- Make sure you have credits in your OpenAI account

### "Port already in use"
- Change PORT in `.env` to 3001 or another available port
- Update VITE_API_URL accordingly

## 🎨 Customization Ideas

1. **Add More Job Sources**
   - Copy `scripts/crawlers/lever-api.ts` and modify for other sources
   - Ideas: Indeed API, LinkedIn, AngelList, Y Combinator jobs

2. **Improve UI**
   - Add animations with Framer Motion
   - Use shadcn/ui components for better design
   - Add dark mode

3. **Better Matching**
   - Use GPT-4 for more nuanced job descriptions
   - Add salary prediction
   - Implement job recommendations

## 📊 Monitoring Costs

- **Supabase Free Tier**: 500MB database, 2GB bandwidth (plenty for MVP)
- **OpenAI Embeddings**: ~$0.01 per 1,000 jobs embedded
- **Vercel Free Tier**: 100GB bandwidth, serverless functions

**Expected monthly cost for 100-200 users: $5-20**

## 🚀 Deployment

### Deploy Frontend + API to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts to deploy
```

Add environment variables in Vercel dashboard:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- DATABASE_URL
- OPENAI_API_KEY

## 🎓 Learning Resources

- **Hono Docs**: https://hono.dev
- **Drizzle ORM**: https://orm.drizzle.team
- **pgvector Guide**: https://github.com/pgvector/pgvector
- **OpenAI Embeddings**: https://platform.openai.com/docs/guides/embeddings

---

**You're all set! Build something amazing this weekend! 🚀**

