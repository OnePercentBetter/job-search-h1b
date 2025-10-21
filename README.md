# Job Search App

A simple job search platform I built to help college students find new grad roles and internships. It uses AI to match your preferences with relevant job postings.

## What it does

- Searches jobs from multiple sources (GitHub, company sites, etc.)
- Uses AI embeddings to find jobs that match your profile
- Tracks your applications and saves interesting positions
- Filters by location, remote work, job type, and visa sponsorship

## Tech stack

- Frontend: React + Vite + Tailwind
- Backend: Hono (TypeScript framework)
- Database: PostgreSQL with pgvector for similarity search
- AI: OpenAI embeddings API
- Auth: Supabase (when I get around to it)

## Getting started

### Prerequisites

You'll need:
- Node.js 18+
- A Supabase account (free tier works fine)
- OpenAI API key (embeddings are cheap, like $5-10)

### Setup

1. Clone and install dependencies:
```bash
git clone <your-repo>
cd job-search
npm install
```

2. Set up your environment variables. Create a `.env` file in the root:

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

3. Set up the database:
```bash
npm run db:generate
npm run db:push
```

4. (Optional) Add some test jobs:
```bash
npm run crawl
```

5. Start the app:
```bash
npm run dev
```

Visit http://localhost:5173 to see the frontend.

## How it works

The app crawls job postings from various sources and stores them in a PostgreSQL database. Each job gets converted to a vector embedding using OpenAI's API. When you search, it converts your query to an embedding and finds similar jobs using cosine similarity.

The visa sponsorship stuff is still a work in progress - I'm pulling data from USCIS and trying to match it with job postings.

## Project structure

```
job-search/
├── apps/
│   ├── api/          # Backend API
│   └── web/          # React frontend
├── scripts/
│   └── crawlers/     # Job scraping scripts
└── drizzle/          # Database migrations
```

## Available scripts

- `npm run dev` - Start both frontend and API
- `npm run dev:api` - Just the API
- `npm run dev:web` - Just the frontend
- `npm run crawl` - Run job crawler
- `npm run db:push` - Update database schema
- `npm run db:studio` - Open database GUI

## API endpoints

- `GET /api/jobs` - List jobs with optional filters
- `GET /api/jobs/search` - Search with AI matching
- `GET /api/jobs/:id` - Get specific job
- `GET /api/applications` - Your saved applications
- `POST /api/applications` - Save a job
- `PUT /api/profile` - Update your profile

## Deployment

I deployed this on Vercel. The frontend goes to Vercel, API as serverless functions, and database stays on Supabase.

```bash
npm i -g vercel
vercel
```

Don't forget to add your environment variables in the Vercel dashboard.

## Issues I'm still working on

- Authentication is half-implemented
- Need to add more job sources
- The UI could use some polish
- Want to add email notifications for new matches

## Costs

Running this costs almost nothing:
- Supabase free tier: 500MB database
- OpenAI embeddings: ~$0.01 per 1000 jobs
- Vercel free tier: 100GB bandwidth

For a few hundred users, maybe $5-20/month total.

## License

MIT

---

Built this to solve my own job search problems. Feel free to use it or suggest improvements.