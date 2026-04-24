import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
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

    const tokensListFn = fn("TokensListFn", "tokens-list.ts");
    tokensTable.grantReadData(tokensListFn);

    const tokensCreateFn = fn("TokensCreateFn", "tokens-create.ts");
    tokensTable.grantReadWriteData(tokensCreateFn);

    const tokensRevokeFn = fn("TokensRevokeFn", "tokens-revoke.ts");
    tokensTable.grantReadWriteData(tokensRevokeFn);

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
    uploadsCompleteFn.addEnvironment("RENDER_FN_NAME", renderWorkerFn.functionName);
    renderWorkerFn.grantInvoke(uploadsCompleteFn);

    const uploadsReviewFn = fn("UploadsReviewFn", "uploads-review.ts");
    uploadsTable.grantReadWriteData(uploadsReviewFn);
    usersTable.grantReadData(uploadsReviewFn);

    const schemaGetFn = fn("SchemaGetFn", "schema-get.ts");
    schemaTable.grantReadData(schemaGetFn);

    const schemaUpdateFn = fn("SchemaUpdateFn", "schema-update.ts");
    schemaTable.grantReadWriteData(schemaUpdateFn);

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
    protectedRoute("/admin/tokens", apigw.HttpMethod.GET, tokensListFn);
    protectedRoute("/admin/tokens", apigw.HttpMethod.POST, tokensCreateFn);
    protectedRoute("/admin/tokens/{token}", apigw.HttpMethod.DELETE, tokensRevokeFn);
    protectedRoute("/admin/uploads", apigw.HttpMethod.GET, uploadsListFn);
    protectedRoute("/admin/uploads/{uploadId}", apigw.HttpMethod.PATCH, uploadsReviewFn);
    protectedRoute("/admin/schema", apigw.HttpMethod.GET, schemaGetFn);
    protectedRoute("/admin/schema", apigw.HttpMethod.PUT, schemaUpdateFn);

    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "MediaBucketName", { value: mediaBucket.bucketName });
    new cdk.CfnOutput(this, "JwtSecretArn", { value: jwtSecret.secretArn });
  }
}
