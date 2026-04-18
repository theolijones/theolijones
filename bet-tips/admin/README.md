# Bet Tips — Admin

React + Vite web app for staff:

- Log in with admin email + password (seeded via the backend)
- Issue/list/revoke mobile signup tokens
- Review pending video uploads; approve or reject with a note
- Edit the metadata schema that mobile uploads must conform to

## Setup

```bash
cd bet-tips/admin
npm install
cp .env.example .env
# edit VITE_API_URL to point at the deployed API Gateway URL
npm run dev
```

Admin login uses credentials created via `backend/scripts/seed-admin.ts`.
