# Bet Tips

Mobile app for recording TikTok-style betting tip videos, plus admin panel and AWS backend.

Three independent sub-projects:

| Path | What | Stack |
|---|---|---|
| `backend/` | API, storage, auth | AWS CDK (Lambda, API Gateway, DynamoDB, S3) |
| `admin/` | Staff console | React + Vite + TypeScript |
| `mobile/` | User app | Expo React Native + TypeScript |

Each sub-project has its own `README.md` with setup instructions. They can be split into separate repositories later with no code changes.

## Phase 1 (current)

- Admin login, signup-token issuance, uploads review queue, metadata-schema editor
- Mobile sign-up (Sportsbet username + signup token), persistent auth, blank home screen
- Backend: users, signup tokens, uploads, rejections, metadata schema; S3 bucket ready for videos

## Phase 2+ (later)

Camera, editor (text/image/video/GIF/music/audio overlays), bet-share-link capture and tap-to-copy, rejection notifications, QC workflow wiring.
