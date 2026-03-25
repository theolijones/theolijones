# IP Sentinel

AFL/NRL intellectual property monitoring platform for tracking unauthorised use of league IP by betting companies on social media.

## What It Does

- **Monitors** social media accounts (Instagram, Facebook, TikTok, X) of 218 Australian betting companies
- **Scrapes** posts every 4 hours using Apify actors
- **Analyses** images and captions using Claude's vision API to detect AFL/NRL IP infringement
- **Alerts** a mailing list immediately when violations are detected (confidence >= 70%)
- **Reports** weekly digest every Monday at 8am AEST with leaderboards and summaries
- **Dashboard** for compliance teams to review, filter, and dismiss infractions

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Frontend | React 18, Vite, Tailwind CSS v4 |
| Database | PostgreSQL (raw SQL, auto-migrations) |
| Scraping | Apify (`apify-client`) |
| IP Detection | Anthropic Claude claude-sonnet-4-20250514 vision API |
| Email | SendGrid (`@sendgrid/mail`) |
| Scheduling | `node-cron` (in-process) |
| Auth | JWT + bcrypt, httpOnly cookies |
| Deployment | Google Cloud Run (single container) |

## Project Structure

```
├── server/
│   ├── index.js              # Express app, serves API + static frontend
│   ├── db.js                 # PostgreSQL pool, migrations, admin seeding
│   ├── auth.js               # JWT + admin middleware
│   ├── routes/
│   │   ├── auth.js           # Login, logout, /me
│   │   ├── users.js          # User CRUD (admin)
│   │   ├── companies.js      # Company CRUD
│   │   ├── accounts.js       # Social account management
│   │   ├── infractions.js    # Infraction list, detail, dismiss
│   │   ├── dashboard.js      # Summary, leaderboard, recent, timeline
│   │   ├── mailingList.js    # Mailing list CRUD (admin)
│   │   ├── reports.js        # Weekly report list/detail
│   │   └── admin.js          # Manual scrape/report triggers
│   └── services/
│       ├── apifyService.js   # Apify actor runner + post normaliser
│       ├── ipAnalysisService.js  # Claude vision IP analysis
│       ├── emailService.js   # SendGrid immediate + weekly digest
│       └── scheduler.js      # Cron jobs (4h scrape, weekly report)
├── client/
│   ├── src/
│   │   ├── pages/            # 7 pages (Dashboard, Companies, Infractions, etc.)
│   │   ├── components/       # Layout, AuthContext, ProtectedRoute
│   │   └── api/              # Fetch wrappers per resource
│   └── vite.config.js
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_reports_table.sql
│   └── 003_seed_companies.sql  # 218 companies + ~90 social accounts
├── scripts/
│   ├── test-apify.js
│   └── test-claude.js
├── Dockerfile
├── cloudbuild.yaml
└── .env.example
```

## Pre-seeded Data

The app ships with **218 Australian betting companies** from betseeker.com.au and **~90 verified social media accounts** across 30 major bookmakers including:

Sportsbet, Ladbrokes, Neds, Bet365, TAB, PointsBet, Unibet, BlueBet, Betr, Dabble, Palmerbet, TopSport, BetRight, Picklebet, PlayUp, Colossalbet, EliteBet, BetDeluxe, Bet Nation, Betfair, betM, RobWaterhouse.com, and more.

---

## Launch Guide

### Prerequisites

- **Node.js 20+**
- **PostgreSQL 14+** (local or hosted — e.g. Cloud SQL, Supabase, Neon)
- **Apify account** with API token — [apify.com](https://apify.com)
- **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)
- **SendGrid account** with API key and verified sender — [sendgrid.com](https://sendgrid.com)

### Step 1: Clone and install

```bash
git clone https://github.com/theolijones/theolijones.git
cd theolijones
npm install
```

### Step 2: Create the database

```bash
createdb ipsentinel
# Or via psql:
# psql -c "CREATE DATABASE ipsentinel;"
```

### Step 3: Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DATABASE_URL=postgres://user:password@localhost:5432/ipsentinel
JWT_SECRET=generate-a-long-random-string-here
APIFY_API_TOKEN=apify_api_your_token
ANTHROPIC_API_KEY=sk-ant-your_key
SENDGRID_API_KEY=SG.your_key
SENDGRID_FROM_EMAIL=alerts@yourdomain.com
PORT=8080
NODE_ENV=development
```

**Generate a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 4: Build the frontend

```bash
npm run build:client
```

### Step 5: Start the app

```bash
npm start
```

On first run, the app will:
1. Run all database migrations (creates tables, seeds 218 companies + social accounts)
2. Create a default admin user and log credentials to the console
3. Start the cron scheduler (scrapes every 4 hours, weekly report Mondays 8am AEST)
4. Listen on port 8080

### Step 6: Log in

Open `http://localhost:8080` and log in with:

- **Email:** `admin@ipsentinel.local`
- **Password:** `ChangeMe123!`

**Change this password immediately** via the Users page.

### Step 7: Configure mailing list

Go to **Mailing List** in the sidebar and add email recipients who should receive:
- Immediate alerts when IP infringements are detected
- Weekly digest reports every Monday

### Step 8: Verify API connectivity (optional)

```bash
# Test Apify connection
node scripts/test-apify.js

# Test Claude API connection
node scripts/test-claude.js
```

### Step 9: Trigger a test scrape

Either wait for the 4-hour cron cycle, or trigger manually:
- Click **Dashboard** → the scraper will run on schedule
- Or use the admin API: `POST /api/admin/scrape-now` (requires auth)

---

## Deploying to Google Cloud Run

### Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated
- Cloud SQL PostgreSQL instance (or any accessible PostgreSQL)

### Option A: Cloud Build (CI/CD)

```bash
# Set up Cloud SQL and get the connection string
# Then set env vars in Cloud Run console or via gcloud

gcloud builds submit --config=cloudbuild.yaml
```

### Option B: Manual Docker deploy

```bash
# Build
docker build -t gcr.io/YOUR_PROJECT/ip-sentinel .

# Push
docker push gcr.io/YOUR_PROJECT/ip-sentinel

# Deploy
gcloud run deploy ip-sentinel \
  --image gcr.io/YOUR_PROJECT/ip-sentinel \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "DATABASE_URL=postgres://...,JWT_SECRET=...,APIFY_API_TOKEN=...,ANTHROPIC_API_KEY=...,SENDGRID_API_KEY=...,SENDGRID_FROM_EMAIL=...,NODE_ENV=production"
```

### Environment variables for Cloud Run

Set all variables from `.env.example` as Cloud Run environment variables. Use **Cloud SQL Auth Proxy** or a direct connection string for `DATABASE_URL`. Set `DATABASE_SSL=true` if connecting over SSL.

---

## Development

### Run frontend and backend separately

```bash
# Terminal 1: Backend (auto-restarts on changes)
npm run dev:server

# Terminal 2: Frontend (hot reload, proxies /api to :8080)
npm run dev:client
```

The Vite dev server runs on port 5173 and proxies all `/api` requests to the Express server on port 8080.

### Database

Migrations run automatically on startup. To add a new migration, create a numbered `.sql` file in `/migrations/` (e.g. `004_add_new_table.sql`).

---

## Remaining Tasks Before Production

### Required

- [ ] **Set up PostgreSQL** — local for dev, Cloud SQL or equivalent for production
- [ ] **Obtain API keys** — Apify, Anthropic, SendGrid
- [ ] **Verify SendGrid sender** — domain or single sender verification required
- [ ] **Configure Apify actors** — the default actor IDs in `settings` table may need updating to match your Apify account's available actors. Test with `scripts/test-apify.js`
- [ ] **Change default admin password** after first login
- [ ] **Add mailing list recipients** via the admin UI

### Recommended

- [ ] **Verify social media handles** — the seeded handles were sourced via web search and should be spot-checked against actual accounts before relying on scrape results
- [ ] **Add social accounts for smaller bookmakers** — 188 of the 218 companies have no social accounts yet. Add them via the Companies page as you identify active ones
- [ ] **Set up Cloud SQL** with automated backups
- [ ] **Configure a custom domain** with Cloud Run domain mapping
- [ ] **Set up monitoring** — Cloud Run logs are prefixed with `[SCRAPE]`, `[ANALYSE]`, `[EMAIL]`, `[SCHEDULER]` for easy filtering
- [ ] **Rate limit the API** — consider adding `express-rate-limit` for production
- [ ] **Add HTTPS** — handled automatically by Cloud Run, but configure `secure: true` on cookies

### Optional Enhancements

- [ ] Add more platforms (YouTube, LinkedIn) as scrape targets
- [ ] Implement retry queue for failed Claude API analyses
- [ ] Add bulk import/export for companies and accounts
- [ ] Set up Slack webhook alerts alongside email
- [ ] Add 2FA for admin accounts
- [ ] Implement audit logging for admin actions

---

## API Overview

All routes under `/api`. Auth required except `/api/auth/login` and `/api/auth/logout`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login, returns JWT cookie |
| POST | `/api/auth/logout` | Public | Clears JWT cookie |
| GET | `/api/auth/me` | User | Current user info |
| GET | `/api/users` | Admin | List users |
| POST | `/api/users` | Admin | Create user |
| PATCH | `/api/users/:id` | Admin | Update user |
| DELETE | `/api/users/:id` | Admin | Delete user |
| GET | `/api/companies` | User | List companies |
| POST | `/api/companies` | Admin | Create company |
| PATCH | `/api/companies/:id` | Admin | Update company |
| DELETE | `/api/companies/:id` | Admin | Soft delete (deactivate) |
| GET | `/api/companies/:id/accounts` | User | List social accounts |
| POST | `/api/companies/:id/accounts` | Admin | Add social account |
| PATCH | `/api/accounts/:id` | Admin | Update/toggle account |
| DELETE | `/api/accounts/:id` | Admin | Delete account |
| GET | `/api/infractions` | User | Paginated + filtered list |
| GET | `/api/infractions/:id` | User | Infraction detail |
| PATCH | `/api/infractions/:id/dismiss` | Admin | Dismiss with reason |
| GET | `/api/dashboard/summary` | User | Stats overview |
| GET | `/api/dashboard/leaderboard` | User | Companies ranked |
| GET | `/api/dashboard/recent` | User | 10 latest infractions |
| GET | `/api/dashboard/timeline` | User | 30-day daily counts |
| GET | `/api/mailing-list` | Admin | List recipients |
| POST | `/api/mailing-list` | Admin | Add recipient |
| PATCH | `/api/mailing-list/:id` | Admin | Update recipient |
| DELETE | `/api/mailing-list/:id` | Admin | Delete recipient |
| GET | `/api/reports` | User | List weekly reports |
| GET | `/api/reports/:id` | User | Report detail |
| POST | `/api/admin/scrape-now` | Admin | Trigger immediate scrape |
| POST | `/api/admin/send-weekly-report` | Admin | Trigger weekly report |

---

## Default Admin Credentials

| Field | Value |
|---|---|
| Email | `admin@ipsentinel.local` |
| Password | `ChangeMe123!` |
| Role | `admin` |

**Change immediately after first login.**
