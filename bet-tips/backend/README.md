# Bet Tips — Backend

AWS CDK app: API Gateway (HTTP API) + Lambda + DynamoDB + S3 + Secrets Manager.

## Resources

| Logical | Purpose |
|---|---|
| `UsersTable` | Users (admins + mobile users). GSIs: `byEmail`, `bySportsbetUsername` |
| `SignupTokensTable` | One-time signup codes issued from admin. GSI: `byStatus` |
| `UploadsTable` | Video submissions with pending/approved/rejected state. GSIs: `byStatus`, `byUser` |
| `MetadataSchemaTable` | Single item defining the JSON schema for upload metadata |
| `MediaBucket` | Video files + sidecar JSON metadata + bet-share images |
| `JwtSecret` | HMAC secret for signing auth tokens |

## Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | public | Mobile sign-up with Sportsbet username + signup token |
| POST | `/auth/login` | public | Admin login (email + password) |
| POST | `/auth/refresh` | public | Exchange refresh token for new access token |
| GET | `/me` | any | Current user info |
| GET | `/admin/tokens` | admin | List signup tokens (optional `?status=`) |
| POST | `/admin/tokens` | admin | Issue a new signup token |
| DELETE | `/admin/tokens/{token}` | admin | Revoke an active token |
| GET | `/admin/uploads` | admin | List uploads (`?status=pending\|approved\|rejected`) |
| PATCH | `/admin/uploads/{uploadId}` | admin | Approve or reject an upload |
| GET | `/admin/schema` | any | Read current metadata schema |
| PUT | `/admin/schema` | admin | Replace metadata schema |

## Deploy

```bash
cd bet-tips/backend
npm install
npx cdk bootstrap            # once per account/region
npm run deploy
```

Outputs include `ApiUrl`, `MediaBucketName`, `JwtSecretArn`.

## Seed the first admin user

After the stack has deployed, create the first admin account:

```bash
USERS_TABLE=<UsersTable name from CF outputs> \
ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD='change-me-now' \
npx ts-node scripts/seed-admin.ts
```

Log in to the admin panel with that email and password.
