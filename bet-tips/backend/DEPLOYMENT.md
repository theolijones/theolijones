# Bet Tips — AWS Setup & Deployment

How to get a machine ready to deploy the backend, and how to deploy it.

The backend is an **AWS CDK** app. CDK turns `lib/bet-tips-stack.ts` into a CloudFormation
stack called `BetTipsStack` and applies it. You never create resources by hand in the AWS
console — the code is the source of truth, and anything you click together manually will be
reverted or deleted by the next deploy.

Default region is **`ap-southeast-2`** (Sydney), set in `bin/app.ts`. Override with
`CDK_DEFAULT_REGION`.

## Prerequisites

| Tool | Why | Check |
|---|---|---|
| Node.js 20+ | CDK CLI and Lambda bundling | `node -v` |
| Docker | **Required.** `RenderWorkerFn` is a container Lambda built from `render-worker/Dockerfile` | `docker info` |
| AWS credentials | CDK calls AWS APIs as you | see below |
| AWS CLI | Not strictly required by CDK, but the easiest way to set up and verify credentials | `aws --version` |

Docker must be **running**, not just installed. Without it the deploy fails at the
`RenderWorkerFn` asset bundling step — the other 25-odd Lambdas bundle fine with esbuild, so
the failure appears well into the deploy rather than at the start.

## First-time machine setup

### 1. Install the AWS CLI

```bash
brew install awscli
```

### 2. Configure credentials

```bash
aws configure
```

Supply the access key ID, secret access key, and `ap-southeast-2` as the default region.
This writes `~/.aws/credentials` and `~/.aws/config`. CDK reads the same files, so this is
the only credential setup needed.

Verify you're pointed at the right account:

```bash
aws sts get-caller-identity
```

### 3. Bootstrap the account/region

Once per account/region pair. Creates the S3 bucket and IAM roles CDK uses to stage assets.

```bash
cd bet-tips/backend
npm install
npx cdk bootstrap
```

Already-bootstrapped accounts are a no-op, so it's safe to re-run.

## Deploying

```bash
cd bet-tips/backend
npm install
npm run diff     # review what will change — do this first
npm run deploy
```

`npm run diff` prints the resource-level changes before anything is applied. **Read it.**
Pay particular attention to any line beginning with `[-]` — that's a resource being
**destroyed**. See the warning below.

On success CDK prints the stack outputs:

| Output | Use |
|---|---|
| `ApiUrl` | Base URL for the HTTP API — goes into `admin/.env` as `VITE_API_URL` |
| `MediaBucketName` | S3 bucket holding videos, metadata sidecars, bet-share images |
| `JwtSecretArn` | Secrets Manager ARN for the JWT signing key |

### Seed the first admin

The stack creates no users. After the first deploy:

```bash
USERS_TABLE=<UsersTable name from stack outputs> \
ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD='change-me-now' \
npx ts-node scripts/seed-admin.ts
```

### Point the admin console at the API

```bash
cd bet-tips/admin
cp .env.example .env      # set VITE_API_URL to the ApiUrl output
```

`admin/.env` is git-ignored, so a fresh clone will not have it. Recreate it from
`.env.example` on every new machine.

## ⚠️ The deployed stack contains resources this repo does not define

The live CloudFormation stack includes `AdminSiteBucket`, `AdminSiteDistribution`, and
`AdminSiteDeployment` (a `Custom::CDKBucketDeployment`) — the S3 bucket and CloudFront
distribution that serve the admin console at `dgdbxaxyd66xf.cloudfront.net`.

**Those three resources appear in no branch of this repository.** They are not in
`lib/bet-tips-stack.ts` on `main`, `phase-2/stage-a-upload-pipeline`, or any other branch.

CDK deletes resources that are absent from the code. So running `cdk deploy` from the repo
as it currently stands is expected to **tear down the admin console** — the bucket, the
CloudFront distribution, and the hosted site with them.

Before deploying, do one of:

1. Run `npm run diff` and confirm no `AdminSite*` resource is marked for deletion, **or**
2. Find the machine holding the uncommitted admin-site code, commit it, and deploy from that.

The most likely explanation is that the admin-site constructs were added locally on another
machine and deployed without being committed. Recovering that code is the safe path —
without it, redeploying and re-uploading the console is a manual rebuild.

## What gets deployed

### Data

| Logical ID | Type | Notes |
|---|---|---|
| `UsersTable` | DynamoDB | GSIs `byEmail`, `bySportsbetUsername` |
| `SignupTokensTable` | DynamoDB | GSI `byStatus` |
| `UploadsTable` | DynamoDB | GSIs `byStatus`, `byUser` |
| `MetadataSchemaTable` | DynamoDB | Single item holding the upload metadata schema |
| `LibraryAssetsTable` | DynamoDB | GSI `byActive` |
| `MediaBucket` | S3 | Private, S3-managed encryption, CORS open for browser uploads |
| `JwtSecret` | Secrets Manager | 64-char generated HMAC key |

All tables and the bucket use `RemovalPolicy.RETAIN` — `cdk destroy` leaves them behind
rather than deleting your data. They then have to be removed by hand if you really want them
gone, and their names will collide on a fresh deploy.

### Compute

Every route is a Lambda. Standard functions are Node 20, ARM64, 512 MB, 10 s timeout,
bundled by esbuild with minification and source maps.

The exception is `RenderWorkerFn` — a Docker image Lambda, ARM64, **3008 MB**, 2 GB ephemeral
storage, **10 minute** timeout. It is invoked asynchronously by `UploadsCompleteFn` rather
than being wired to an API route.

### API

`Api` is an API Gateway **HTTP API** (v2), CORS open to `*`. Auth is a Lambda request
authorizer (`AuthorizerFn`) reading the `Authorization` header, with **caching disabled**
(`resultsCacheTtl: 0`) so revoked tokens take effect immediately.

Public routes: `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`.
Everything else requires a valid JWT. See `backend/README.md` for the route table.

## Troubleshooting

**`Cannot connect to the Docker daemon`** — Docker Desktop isn't running. Start it and
re-run.

**`This stack uses assets, so the toolkit stack must be deployed`** — the account/region
isn't bootstrapped. Run `npx cdk bootstrap`.

**`Unable to locate credentials` / `ExpiredToken`** — no credentials, or they've expired.
Re-run `aws configure` and confirm with `aws sts get-caller-identity`.

**Deployed to the wrong region** — `bin/app.ts` falls back to `ap-southeast-2` only when
`CDK_DEFAULT_REGION` is unset. A different region in `~/.aws/config` wins, and produces a
second, parallel copy of the whole stack rather than an error.

**Admin console shows stale content after a deploy** — CloudFront caching. The
`AdminSiteDeployment` construct normally invalidates on deploy; if it hasn't, invalidate
`/*` on the distribution manually.
