import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { DockerImageCode, DockerImageFunction } from "aws-cdk-lib/aws-lambda";

export class BetTipsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const usersTable = new dynamodb.Table(this, "UsersTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    usersTable.addGlobalSecondaryIndex({
      indexName: "byEmail",
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
    });
    usersTable.addGlobalSecondaryIndex({
      indexName: "bySportsbetUsername",
      partitionKey: { name: "sportsbetUsername", type: dynamodb.AttributeType.STRING },
    });

    const tokensTable = new dynamodb.Table(this, "SignupTokensTable", {
      partitionKey: { name: "token", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    tokensTable.addGlobalSecondaryIndex({
      indexName: "byStatus",
      partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
    });

    const uploadsTable = new dynamodb.Table(this, "UploadsTable", {
      partitionKey: { name: "uploadId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    uploadsTable.addGlobalSecondaryIndex({
      indexName: "byStatus",
      partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
    });
    uploadsTable.addGlobalSecondaryIndex({
      indexName: "byUser",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
    });

    const schemaTable = new dynamodb.Table(this, "MetadataSchemaTable", {
      partitionKey: { name: "schemaId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const libraryTable = new dynamodb.Table(this, "LibraryAssetsTable", {
      partitionKey: { name: "assetId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    libraryTable.addGlobalSecondaryIndex({
      indexName: "byActive",
      partitionKey: { name: "active", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
    });

    const mediaBucket = new s3.Bucket(this, "MediaBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: cdk.Duration.days(7) }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const jwtSecret = new secrets.Secret(this, "JwtSecret", {
      description: "HMAC secret for signing JWTs",
      generateSecretString: {
        passwordLength: 64,
        excludePunctuation: true,
      },
    });

    const commonEnv: Record<string, string> = {
      USERS_TABLE: usersTable.tableName,
      TOKENS_TABLE: tokensTable.tableName,
      UPLOADS_TABLE: uploadsTable.tableName,
      SCHEMA_TABLE: schemaTable.tableName,
      LIBRARY_TABLE: libraryTable.tableName,
      MEDIA_BUCKET: mediaBucket.bucketName,
      JWT_SECRET_ARN: jwtSecret.secretArn,
      NODE_OPTIONS: "--enable-source-maps",
    };

    const lambdaDefaults: Partial<cdk.aws_lambda_nodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      architecture: lambda.Architecture.ARM_64,
      bundling: { minify: true, sourceMap: true, target: "node20" },
      environment: commonEnv,
    };

    const fn = (id: string, file: string): NodejsFunction =>
      new NodejsFunction(this, id, {
        ...lambdaDefaults,
        entry: path.join(__dirname, "..", "lambda", file),
        handler: "handler",
      });

    const authorizerFn = fn("AuthorizerFn", "authorizer.ts");
    jwtSecret.grantRead(authorizerFn);

    const signupFn = fn("SignupFn", "signup.ts");
    usersTable.grantReadWriteData(signupFn);
    tokensTable.grantReadWriteData(signupFn);
    jwtSecret.grantRead(signupFn);

    const loginFn = fn("LoginFn", "login.ts");
    usersTable.grantReadData(loginFn);
    jwtSecret.grantRead(loginFn);

    const refreshFn = fn("RefreshFn", "refresh.ts");
    usersTable.grantReadData(refreshFn);
    jwtSecret.grantRead(refreshFn);

    const meFn = fn("MeFn", "me.ts");
    usersTable.grantReadData(meFn);

    const mePushTokenFn = fn("MePushTokenFn", "me-push-token.ts");
    usersTable.grantReadWriteData(mePushTokenFn);

    const usersListFn = fn("UsersListFn", "users-list.ts");
    usersTable.grantReadData(usersListFn);

    const usersTemplatesFn = fn("UsersTemplatesFn", "users-templates.ts");
    usersTable.grantReadWriteData(usersTemplatesFn);

    const adminsListFn = fn("AdminsListFn", "admins-list.ts");
    usersTable.grantReadData(adminsListFn);

    // Queries the byEmail GSI to reject duplicates, then writes the new account.
    const adminsCreateFn = fn("AdminsCreateFn", "admins-create.ts");
    usersTable.grantReadWriteData(adminsCreateFn);

    const adminsPasswordFn = fn("AdminsPasswordFn", "admins-password.ts");
    usersTable.grantReadWriteData(adminsPasswordFn);

    const tokensListFn = fn("TokensListFn", "tokens-list.ts");
    tokensTable.grantReadData(tokensListFn);

    const tokensCreateFn = fn("TokensCreateFn", "tokens-create.ts");
    tokensTable.grantReadWriteData(tokensCreateFn);

    const tokensRevokeFn = fn("TokensRevokeFn", "tokens-revoke.ts");
    tokensTable.grantReadWriteData(tokensRevokeFn);

    const tokensUpdateFn = fn("TokensUpdateFn", "tokens-update.ts");
    tokensTable.grantReadWriteData(tokensUpdateFn);
    usersTable.grantReadWriteData(tokensUpdateFn);

    const uploadsListFn = fn("UploadsListFn", "uploads-list.ts");
    uploadsTable.grantReadData(uploadsListFn);
    usersTable.grantReadData(uploadsListFn);
    mediaBucket.grantRead(uploadsListFn);

    const uploadsCreateFn = fn("UploadsCreateFn", "uploads-create.ts");
    uploadsTable.grantWriteData(uploadsCreateFn);
    mediaBucket.grantPut(uploadsCreateFn);

    const uploadsAssetFn = fn("UploadsAssetFn", "uploads-asset.ts");
    uploadsTable.grantReadWriteData(uploadsAssetFn);
    mediaBucket.grantPut(uploadsAssetFn);

    const uploadsMineFn = fn("UploadsMineFn", "uploads-mine.ts");
    uploadsTable.grantReadData(uploadsMineFn);
    mediaBucket.grantRead(uploadsMineFn);

    const renderWorkerFn = new DockerImageFunction(this, "RenderWorkerFn", {
      code: DockerImageCode.fromImageAsset(path.join(__dirname, ".."), {
        file: "render-worker/Dockerfile",
      }),
      architecture: lambda.Architecture.ARM_64,
      memorySize: 3008,
      ephemeralStorageSize: cdk.Size.mebibytes(2048),
      timeout: cdk.Duration.minutes(10),
      environment: {
        UPLOADS_TABLE: uploadsTable.tableName,
        MEDIA_BUCKET: mediaBucket.bucketName,
      },
    });
    uploadsTable.grantReadWriteData(renderWorkerFn);
    mediaBucket.grantReadWrite(renderWorkerFn);

    const uploadsCompleteFn = fn("UploadsCompleteFn", "uploads-complete.ts");
    uploadsTable.grantReadWriteData(uploadsCompleteFn);
    mediaBucket.grantRead(uploadsCompleteFn);
    // Writes the metadata.json sidecar next to the video (added in 4b5bb0d).
    mediaBucket.grantPut(uploadsCompleteFn);
    uploadsCompleteFn.addEnvironment("RENDER_FN_NAME", renderWorkerFn.functionName);
    renderWorkerFn.grantInvoke(uploadsCompleteFn);

    // Rewrites the stored video's display-rotation tag. ffmpeg only exists in
    // the render-worker image, so this handler just invokes that synchronously;
    // its own IAM needs nothing beyond the invoke.
    //
    // Not built via fn(): the 10s default would expire while waiting on the
    // render-worker's download + stream copy + upload, especially on a
    // container cold start. 29s is the ceiling that still fits inside API
    // Gateway's fixed 30s integration timeout.
    const uploadsRotateFn = new NodejsFunction(this, "UploadsRotateFn", {
      ...lambdaDefaults,
      entry: path.join(__dirname, "..", "lambda", "uploads-rotate.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(29),
      environment: {
        ...commonEnv,
        RENDER_FN_NAME: renderWorkerFn.functionName,
      },
    });
    renderWorkerFn.grantInvoke(uploadsRotateFn);

    const uploadsReviewFn = fn("UploadsReviewFn", "uploads-review.ts");
    uploadsTable.grantReadWriteData(uploadsReviewFn);
    usersTable.grantReadData(uploadsReviewFn);

    const libraryListFn = fn("LibraryListFn", "library-list.ts");
    libraryTable.grantReadData(libraryListFn);
    mediaBucket.grantRead(libraryListFn);

    const libraryCreateFn = fn("LibraryCreateFn", "library-create.ts");
    libraryTable.grantReadWriteData(libraryCreateFn);
    mediaBucket.grantPut(libraryCreateFn);

    const libraryUpdateFn = fn("LibraryUpdateFn", "library-update.ts");
    libraryTable.grantReadWriteData(libraryUpdateFn);

    const libraryDeleteFn = fn("LibraryDeleteFn", "library-delete.ts");
    libraryTable.grantReadWriteData(libraryDeleteFn);
    mediaBucket.grantDelete(libraryDeleteFn);

    const api = new apigw.HttpApi(this, "Api", {
      corsPreflight: {
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [
          apigw.CorsHttpMethod.GET,
          apigw.CorsHttpMethod.POST,
          apigw.CorsHttpMethod.PUT,
          apigw.CorsHttpMethod.PATCH,
          apigw.CorsHttpMethod.DELETE,
          apigw.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["*"],
        maxAge: cdk.Duration.days(1),
      },
    });

    const authorizer = new authorizers.HttpLambdaAuthorizer("JwtAuthorizer", authorizerFn, {
      responseTypes: [authorizers.HttpLambdaResponseType.SIMPLE],
      identitySource: ["$request.header.Authorization"],
      resultsCacheTtl: cdk.Duration.seconds(0),
    });

    const integ = (f: NodejsFunction) => new integrations.HttpLambdaIntegration(`${f.node.id}Integ`, f);

    api.addRoutes({ path: "/auth/signup", methods: [apigw.HttpMethod.POST], integration: integ(signupFn) });
    api.addRoutes({ path: "/auth/login", methods: [apigw.HttpMethod.POST], integration: integ(loginFn) });
    api.addRoutes({ path: "/auth/refresh", methods: [apigw.HttpMethod.POST], integration: integ(refreshFn) });

    const protectedRoute = (p: string, m: apigw.HttpMethod, f: NodejsFunction) =>
      api.addRoutes({ path: p, methods: [m], integration: integ(f), authorizer });

    protectedRoute("/me", apigw.HttpMethod.GET, meFn);
    protectedRoute("/me/push-token", apigw.HttpMethod.POST, mePushTokenFn);
    protectedRoute("/uploads", apigw.HttpMethod.POST, uploadsCreateFn);
    protectedRoute("/uploads", apigw.HttpMethod.GET, uploadsMineFn);
    protectedRoute("/uploads/{uploadId}/complete", apigw.HttpMethod.POST, uploadsCompleteFn);
    protectedRoute("/uploads/{uploadId}/assets", apigw.HttpMethod.POST, uploadsAssetFn);
    protectedRoute("/admin/users", apigw.HttpMethod.GET, usersListFn);
    protectedRoute("/admin/users/{userId}/templates", apigw.HttpMethod.PUT, usersTemplatesFn);
    protectedRoute("/admin/admins", apigw.HttpMethod.GET, adminsListFn);
    protectedRoute("/admin/admins", apigw.HttpMethod.POST, adminsCreateFn);
    protectedRoute("/admin/admins/{userId}/password", apigw.HttpMethod.PUT, adminsPasswordFn);
    protectedRoute("/admin/tokens", apigw.HttpMethod.GET, tokensListFn);
    protectedRoute("/admin/tokens", apigw.HttpMethod.POST, tokensCreateFn);
    protectedRoute("/admin/tokens/{token}", apigw.HttpMethod.DELETE, tokensRevokeFn);
    protectedRoute("/admin/tokens/{token}", apigw.HttpMethod.PATCH, tokensUpdateFn);
    protectedRoute("/admin/uploads", apigw.HttpMethod.GET, uploadsListFn);
    protectedRoute("/admin/uploads/{uploadId}", apigw.HttpMethod.PATCH, uploadsReviewFn);
    protectedRoute("/admin/uploads/{uploadId}/rotate", apigw.HttpMethod.POST, uploadsRotateFn);
    protectedRoute("/library/assets", apigw.HttpMethod.GET, libraryListFn);
    protectedRoute("/admin/library/assets", apigw.HttpMethod.POST, libraryCreateFn);
    protectedRoute("/admin/library/assets/{assetId}", apigw.HttpMethod.PATCH, libraryUpdateFn);
    protectedRoute("/admin/library/assets/{assetId}", apigw.HttpMethod.DELETE, libraryDeleteFn);

    // ---- Admin console hosting -------------------------------------------
    //
    // The console previously existed only as a Vite dev server on one laptop:
    // it died with the terminal, served no TLS, and was unreachable from
    // anywhere else. This puts the built SPA behind CloudFront so it is always
    // up and independent of any one machine.
    //
    // The bucket stays private — CloudFront reaches it through Origin Access
    // Control, so the objects are not directly fetchable from S3.
    const adminDistPath = path.join(__dirname, "..", "..", "admin", "dist");
    if (!fs.existsSync(path.join(adminDistPath, "index.html"))) {
      // Fail at synth rather than silently shipping an empty bucket. The build
      // is not run here on purpose: it needs admin/.env for VITE_API_URL, which
      // is gitignored and local-only.
      throw new Error(
        `admin/dist/index.html not found. Run \`npm run build\` in bet-tips/admin before deploying.`
      );
    }

    const adminBucket = new s3.Bucket(this, "AdminSiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const adminDistribution = new cloudfront.Distribution(this, "AdminSiteDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(adminBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // The console is behind a login and shows review state that changes
        // constantly; caching HTML would serve stale screens after a deploy.
        // Vite fingerprints asset filenames, so those are safe to cache hard
        // and are handled by the default policy on their own URLs.
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: "index.html",
      // Single-page app: React Router owns the paths, so any key S3 doesn't
      // have must fall back to index.html rather than CloudFront's error page.
      // 403 as well as 404 because a private bucket returns AccessDenied for a
      // missing key, not NoSuchKey.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
      comment: "Bet Tips admin console",
    });

    new s3deploy.BucketDeployment(this, "AdminSiteDeployment", {
      sources: [s3deploy.Source.asset(adminDistPath)],
      destinationBucket: adminBucket,
      distribution: adminDistribution,
      // index.html is the one unfingerprinted file, so without an invalidation
      // CloudFront keeps serving the previous build's asset references.
      distributionPaths: ["/index.html"],
    });

    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "MediaBucketName", { value: mediaBucket.bucketName });
    new cdk.CfnOutput(this, "JwtSecretArn", { value: jwtSecret.secretArn });
    new cdk.CfnOutput(this, "AdminUrl", {
      value: `https://${adminDistribution.distributionDomainName}`,
    });
  }
}
