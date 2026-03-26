# Velox — Video Content Management System

A full-stack AWS-native video CMS for broadcast and digital publishing teams.

## Architecture

```
velox/
├── apps/
│   ├── web/           ← React frontend (Vite + TailwindCSS)
│   └── companion/     ← Electron desktop app (Phase 10)
├── packages/
│   ├── api/           ← Express REST API with Cognito JWT auth
│   ├── shared/        ← TypeScript types, constants, utilities
│   ├── aws-clients/   ← Typed AWS SDK v3 wrappers
│   └── infrastructure/← AWS CDK stack definitions
```

## Prerequisites

- Node.js >= 18
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Getting Started

### 1. Install dependencies

```bash
cd velox
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your AWS account details
```

### 3. Deploy infrastructure

```bash
npm run deploy:infra
```

This creates:
- S3 buckets (video source, output, thumbnails, captions, transcripts)
- DynamoDB tables (Videos, Folders, Metadata, Placements, Rules, Schedules, LiveStreams, QARecords, WatchFolders, Modules)
- Cognito user pool with admin/editor/viewer groups
- CloudFront CDN distribution
- IAM roles for MediaConvert and Lambda processing
- SNS topics and SQS queues for async processing

### 4. Start development servers

```bash
# API server (port 3001)
npm run dev:api

# Web frontend (port 5173)
npm run dev:web
```

The frontend proxies `/api` requests to the API server automatically.

### 5. Dev login

In development mode, click "Dev Login (bypass)" on the login page to authenticate without Cognito.

## API Endpoints

Base URL: `/api/v1`

| Resource      | Endpoints                                              |
|---------------|--------------------------------------------------------|
| Videos        | GET/POST /videos, GET/PATCH/DELETE /videos/:id         |
| Transcripts   | GET/PATCH /videos/:id/transcript                       |
| Captions      | GET /videos/:id/captions                               |
| Folders       | GET/POST /folders, PATCH/DELETE /folders/:id            |
| Schema        | GET/PATCH /schema                                      |
| Placements    | GET/POST /placements, PATCH/DELETE /placements/:id     |
| Live Streams  | GET/POST /livestreams, PATCH/DELETE /livestreams/:id   |
| Modules       | GET/POST /modules, PATCH/DELETE /modules/:id           |
| QA            | GET /qa, GET/PATCH /qa/:id                             |
| Analytics     | GET /analytics/video/:id, GET /analytics/dashboard     |

All endpoints require `Authorization: Bearer <token>` header.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, React Query, Zustand
- **Backend**: Node.js, Express, TypeScript
- **Infrastructure**: AWS CDK, DynamoDB, S3, CloudFront, Cognito, MediaConvert, MediaLive, MediaPackage, Transcribe
- **Player**: Bitmovin Web SDK
