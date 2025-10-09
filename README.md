# Job Search Application

A job search platform for college seniors looking for new grad roles and internships. Uses AI-powered vector search to match candidates with their ideal positions.

## 🎯 Features

- **AI-Powered Matching**: Vector embeddings match your preferences with relevant jobs
- **Multi-Source Crawling**: Aggregates jobs from GitHub lists, Lever API, and more
- **Application Tracking**: Save and track your applications through the hiring process
- **Smart Filters**: Filter by location, remote status, and job type
- **Real-time Search**: Natural language search to find exactly what you're looking for

## 🔐 Visa Sponsorship Capabilities
- Dedicated `visa_sponsors` table with curated data (seeded in `data/visa-sponsors.json`)
- Jobs enriched with visa metadata (status, confidence, sponsor notes, link freshness)
- GitHub crawler now fetches live repos and cross-references sponsor data, auto-detects stale postings
- API search supports visa-specific filters (`visaStatus`, `minSponsorshipConfidence`, `requiresVerifiedSponsor`)
- Frontend filters expose sponsor status, confidence thresholds, and verified-only toggle

## 🏗️ Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Hono (TypeScript)
- **Database**: PostgreSQL with pgvector extension
- **AI**: OpenAI embeddings API
- **Auth**: Supabase Auth (planned)

## 📦 Project Structure

```
job-search/
├── apps/
│   ├── api/              # Hono backend
│   │   └── src/
│   │       ├── routes/   # API endpoints
│   │       ├── services/ # Business logic
│   │       ├── db/       # Database schema
│   │       └── lib/      # Utilities
│   └── web/              # Vite + React frontend
│       └── src/
│           ├── pages/    # Route pages
│           └── components/
├── scripts/
│   └── crawlers/         # Job scraping scripts
└── drizzle/              # Database migrations
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase account)
- OpenAI API key

### 1. Clone and Install

```bash
cd job-search
npm install
```

### 2. Environment Setup

Create a `.env` file in the root:

```bash
# Supabase (or regular PostgreSQL)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://user:password@localhost:5432/jobsearch

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# API
PORT=3000

# Frontend
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Database Setup

```bash
# Enable pgvector extension
npm run db:setup

# Generate migrations
npm run db:generate

# Push schema to database
npm run db:push
```

### 4. Seed Jobs (Optional)

```bash
# Run the GitHub crawler
npm run crawl
```

### 5. Start Development

```bash
# Start both API and frontend
npm run dev

# Or start separately:
npm run dev:api  # API on http://localhost:3000
npm run dev:web  # Frontend on http://localhost:5173
```

## 📝 Available Scripts

- `npm run dev` - Start both API and frontend in dev mode
- `npm run build` - Build for production
- `npm run crawl` - Run job crawler
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio (database GUI)

## 🗄️ Database Schema

### Users
- Profile description (text)
- Profile embedding (vector)
- Auth integration

### Jobs
- Title, company, location, description
- Embedding (vector for similarity search)
- Remote status, job type
- Source tracking

### Applications
- User-job relationship
- Status tracking (saved, applied, interviewing, etc.)
- Notes

## 🔍 How It Works

1. **Crawling**: Scripts fetch jobs from multiple sources (GitHub, Lever API, etc.)
2. **Embedding**: OpenAI generates vector embeddings for each job description
3. **Storage**: Jobs stored in PostgreSQL with pgvector extension
4. **Matching**: User describes preferences → system generates embedding → finds similar jobs via cosine similarity
5. **Tracking**: Users save jobs and track application status

## 🎨 Frontend Routes

- `/dashboard` - Search and browse jobs
- `/profile` - Set your job preferences
- `/applications` - Track saved applications
- `/login` - Authentication (to be implemented)

## 🔑 API Endpoints

### Jobs
- `GET /api/jobs/search?description=...&jobType=...` - Search jobs
- `GET /api/jobs/:id` - Get single job

### Applications
- `GET /api/applications` - Get user's applications
- `POST /api/applications` - Save a job
- `PATCH /api/applications/:id` - Update status

### Profile
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update profile & regenerate embedding

## 🚢 Deployment

### Recommended Stack

- **Frontend**: Vercel (or Netlify)
- **API**: Vercel Serverless Functions (or Cloudflare Workers)
- **Database**: Supabase (or AWS RDS)

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## 📈 Scaling Plan

### MVP (1-10 users)
- Serverless functions (Vercel/Cloudflare)
- Supabase free tier
- Manual crawler runs

### Growth (10-100 users)
- Add caching (Redis/Upstash)
- Scheduled crawlers (cron jobs)
- Better auth (Supabase Auth)

### Scale (100-1000 users)
- Dedicated backend server (AWS ECS/Fargate)
- Database optimization (indexes, connection pooling)
- CDN for frontend assets

## 🛠️ Next Steps

- [ ] Implement Supabase authentication
- [ ] Add more job sources (Indeed, LinkedIn, etc.)
- [ ] Schedule automated crawlers
- [ ] Email notifications for new matches
- [ ] Advanced filters (salary, visa sponsorship, etc.)
- [ ] Chrome extension for quick job saving
- [ ] Mobile app (React Native)

## 💡 Tips

- **Vector Search**: The more detailed your profile description, the better the matches
- **Crawlers**: Run crawlers daily to keep job listings fresh
- **Costs**: OpenAI embeddings are ~$0.0001 per 1K tokens (very cheap)
- **Performance**: Add database indexes if searches become slow

## 🐛 Troubleshooting

### "Failed to connect to database"
- Check your `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- For Supabase, use the connection string from Settings → Database

### "OpenAI API error"
- Verify your `OPENAI_API_KEY` is valid
- Check you have API credits

### "pgvector extension not found"
- Run `npm run db:setup` to enable the extension
- For Supabase, it's pre-installed

## 📄 License

MIT

## 🤝 Contributing

This is a personal project, but suggestions are welcome! Open an issue to discuss.

---

**Built with ❤️ for college students navigating the job search**

