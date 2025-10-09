# Job Search Application - Requirements

## Overview

This is a Job search application catered to college seniors looking for new grad roles and internships.

## Core Requirements

### User Features

1. **Selective & Precise Search**
   - Users must be able to selectively and precisely find new grad roles with specific terms and conditions
   - Natural language search powered by AI vector embeddings
   - Filter by location, remote status, job type, salary (future)

2. **Application Tracking**
   - Users must be able to save the applications they've applied to
   - Query through saved applications as they're applying
   - Track status: saved, applied, interviewing, rejected, offer
   - Add notes to each application

3. **Multi-Source Data Aggregation**
   - Crawl data from multiple sources (as many as possible)
   - GitHub new grad lists (primary inspiration)
   - Job board APIs (Lever, Greenhouse, etc.)
   - Company career pages
   - Focus on NYC startups, companies, and remote roles

### Technical Requirements

1. **Database**
   - PostgreSQL with pgvector extension
   - Store job listings with vector embeddings
   - Track user preferences and applications

2. **AI-Powered Matching**
   - Use LLM embeddings to process job descriptions
   - Match user description/preferences to job postings via vector similarity
   - OpenAI text-embedding-3-small model (cost-effective)

3. **Authentication**
   - Required for all users
   - Supabase Auth integration (planned)
   - Google OAuth for college students

4. **UI/UX**
   - Make the UI as seamless as possible
   - Fast, responsive, modern design
   - Mobile-friendly

## User Flow

1. User signs up and describes what they're looking for (job preferences, skills, interests)
2. System generates embedding from user description
3. Crawlers fetch jobs from multiple sources
4. Each job gets an embedding generated
5. Vector similarity search matches user preferences to relevant jobs
6. User browses matches, saves interesting positions
7. User tracks application progress through hiring pipeline

## Target Audience

- College seniors
- Looking for: new grad roles and internships
- Tech-focused (software engineering, product, design, etc.)
- Geographic focus: NYC and remote opportunities

## Success Metrics

- Start with 1 user to validate the concept
- If successful, scale to 100-200 users
- Measure success by:
  - Quality of job matches (user feedback)
  - Number of applications tracked
  - User retention and engagement

## Future Enhancements

- Email notifications for new matching jobs
- Chrome extension for saving jobs from any site
- Salary insights and negotiation tools
- Interview prep resources
- Referral network
- Company reviews and insights

