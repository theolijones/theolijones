import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

export class VeloxStack extends cdk.Stack {
  public readonly videoSourceBucket: s3.Bucket;
  public readonly videoOutputBucket: s3.Bucket;
  public readonly thumbnailsBucket: s3.Bucket;
  public readonly captionsBucket: s3.Bucket;
  public readonly transcriptsBucket: s3.Bucket;
  public readonly userPool: cognito.UserPool;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── S3 Buckets ───────────────────────────────────────────────

    this.videoSourceBucket = new s3.Bucket(this, 'VideoSourceBucket', {
      bucketName: `velox-video-source-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          id: 'cleanup-incomplete-uploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.videoOutputBucket = new s3.Bucket(this, 'VideoOutputBucket', {
      bucketName: `velox-video-output-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.thumbnailsBucket = new s3.Bucket(this, 'ThumbnailsBucket', {
      bucketName: `velox-thumbnails-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.captionsBucket = new s3.Bucket(this, 'CaptionsBucket', {
      bucketName: `velox-captions-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.transcriptsBucket = new s3.Bucket(this, 'TranscriptsBucket', {
      bucketName: `velox-transcripts-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── CloudFront Distribution ──────────────────────────────────

    this.distribution = new cloudfront.Distribution(this, 'CdnDistribution', {
      defaultBehavior: {
        origin: new origins.S3StaticWebsiteOrigin(this.videoOutputBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/thumbnails/*': {
          origin: new origins.S3StaticWebsiteOrigin(this.thumbnailsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        '/captions/*': {
          origin: new origins.S3StaticWebsiteOrigin(this.captionsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
    });

    // ─── DynamoDB Tables ──────────────────────────────────────────

    const videosTable = new dynamodb.Table(this, 'VideosTable', {
      tableName: 'Velox-Videos',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    videosTable.addGlobalSecondaryIndex({
      indexName: 'folderId-index',
      partitionKey: { name: 'folderId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'uploadedAt', type: dynamodb.AttributeType.STRING },
    });
    videosTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'uploadedAt', type: dynamodb.AttributeType.STRING },
    });

    const foldersTable = new dynamodb.Table(this, 'FoldersTable', {
      tableName: 'Velox-Folders',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    foldersTable.addGlobalSecondaryIndex({
      indexName: 'parentId-index',
      partitionKey: { name: 'parentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'name', type: dynamodb.AttributeType.STRING },
    });

    const metadataTable = new dynamodb.Table(this, 'MetadataTable', {
      tableName: 'Velox-Metadata',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const placementsTable = new dynamodb.Table(this, 'PlacementsTable', {
      tableName: 'Velox-Placements',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const rulesTable = new dynamodb.Table(this, 'RulesTable', {
      tableName: 'Velox-Rules',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const schedulesTable = new dynamodb.Table(this, 'SchedulesTable', {
      tableName: 'Velox-Schedules',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    schedulesTable.addGlobalSecondaryIndex({
      indexName: 'placementId-index',
      partitionKey: { name: 'placementId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startAt', type: dynamodb.AttributeType.STRING },
    });

    const livestreamsTable = new dynamodb.Table(this, 'LiveStreamsTable', {
      tableName: 'Velox-LiveStreams',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const qaRecordsTable = new dynamodb.Table(this, 'QARecordsTable', {
      tableName: 'Velox-QARecords',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    qaRecordsTable.addGlobalSecondaryIndex({
      indexName: 'videoId-index',
      partitionKey: { name: 'videoId', type: dynamodb.AttributeType.STRING },
    });
    qaRecordsTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    const watchFoldersTable = new dynamodb.Table(this, 'WatchFoldersTable', {
      tableName: 'Velox-WatchFolders',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const modulesTable = new dynamodb.Table(this, 'ModulesTable', {
      tableName: 'Velox-Modules',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── Cognito User Pool ────────────────────────────────────────

    this.userPool = new cognito.UserPool(this, 'VeloxUserPool', {
      userPoolName: 'velox-users',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        email: { required: true, mutable: false },
        fullname: { required: true, mutable: true },
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = this.userPool.addClient('VeloxWebApp', {
      userPoolClientName: 'velox-web-app',
      authFlows: {
        userSrp: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          'http://localhost:5173/auth/callback',
          'https://velox.example.com/auth/callback',
        ],
        logoutUrls: [
          'http://localhost:5173',
          'https://velox.example.com',
        ],
      },
    });

    const userPoolDomain = this.userPool.addDomain('VeloxDomain', {
      cognitoDomain: {
        domainPrefix: `velox-${this.account}`,
      },
    });

    // Admin group
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admin',
      description: 'Velox administrators',
    });

    // Editor group
    new cognito.CfnUserPoolGroup(this, 'EditorGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'editor',
      description: 'Velox content editors',
    });

    // Viewer group
    new cognito.CfnUserPoolGroup(this, 'ViewerGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'viewer',
      description: 'Velox read-only viewers',
    });

    // ─── IAM Roles ────────────────────────────────────────────────

    const mediaConvertRole = new iam.Role(this, 'MediaConvertRole', {
      roleName: 'velox-mediaconvert-role',
      assumedBy: new iam.ServicePrincipal('mediaconvert.amazonaws.com'),
    });
    this.videoSourceBucket.grantRead(mediaConvertRole);
    this.videoOutputBucket.grantWrite(mediaConvertRole);
    this.thumbnailsBucket.grantWrite(mediaConvertRole);

    const lambdaProcessingRole = new iam.Role(this, 'LambdaProcessingRole', {
      roleName: 'velox-lambda-processing-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    this.videoSourceBucket.grantRead(lambdaProcessingRole);
    this.videoOutputBucket.grantReadWrite(lambdaProcessingRole);
    this.captionsBucket.grantReadWrite(lambdaProcessingRole);
    this.transcriptsBucket.grantReadWrite(lambdaProcessingRole);
    videosTable.grantReadWriteData(lambdaProcessingRole);
    qaRecordsTable.grantReadWriteData(lambdaProcessingRole);

    lambdaProcessingRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'mediaconvert:CreateJob',
          'mediaconvert:GetJob',
          'mediaconvert:DescribeEndpoints',
        ],
        resources: ['*'],
      })
    );

    lambdaProcessingRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'transcribe:StartTranscriptionJob',
          'transcribe:GetTranscriptionJob',
        ],
        resources: ['*'],
      })
    );

    // ─── SNS Topics ──────────────────────────────────────────────

    const videoProcessingTopic = new sns.Topic(this, 'VideoProcessingTopic', {
      topicName: 'velox-video-processing',
    });

    const qaNotificationTopic = new sns.Topic(this, 'QANotificationTopic', {
      topicName: 'velox-qa-notifications',
    });

    // ─── SQS Queues ──────────────────────────────────────────────

    const transcodeQueue = new sqs.Queue(this, 'TranscodeQueue', {
      queueName: 'velox-transcode-queue',
      visibilityTimeout: cdk.Duration.minutes(15),
      retentionPeriod: cdk.Duration.days(7),
    });

    const transcribeQueue = new sqs.Queue(this, 'TranscribeQueue', {
      queueName: 'velox-transcribe-queue',
      visibilityTimeout: cdk.Duration.minutes(30),
      retentionPeriod: cdk.Duration.days(7),
    });

    // ─── Lambda Functions ─────────────────────────────────────────

    const transcodeTriggerFn = new lambda.Function(this, 'TranscodeTriggerFn', {
      functionName: 'velox-transcode-trigger',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'transcode-trigger.handler',
      code: lambda.Code.fromAsset('lambda/transcode-trigger'),
      role: lambdaProcessingRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        VIDEOS_TABLE: videosTable.tableName,
        MEDIACONVERT_ENDPOINT: '', // Set after deploy
        MEDIACONVERT_ROLE_ARN: mediaConvertRole.roleArn,
        S3_BUCKET_VIDEO_OUTPUT: this.videoOutputBucket.bucketName,
        S3_BUCKET_THUMBNAILS: this.thumbnailsBucket.bucketName,
      },
    });

    // Trigger on S3 upload to source bucket
    this.videoSourceBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(transcodeTriggerFn),
      { prefix: 'uploads/' }
    );

    const transcodeCompleteFn = new lambda.Function(this, 'TranscodeCompleteFn', {
      functionName: 'velox-transcode-complete',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'transcode-complete.handler',
      code: lambda.Code.fromAsset('lambda/transcode-complete'),
      role: lambdaProcessingRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        VIDEOS_TABLE: videosTable.tableName,
        CLOUDFRONT_DOMAIN: this.distribution.distributionDomainName,
      },
    });

    // EventBridge rule for MediaConvert job completion
    new events.Rule(this, 'MediaConvertCompleteRule', {
      ruleName: 'velox-mediaconvert-complete',
      eventPattern: {
        source: ['aws.mediaconvert'],
        detailType: ['MediaConvert Job State Change'],
        detail: {
          status: ['COMPLETE', 'ERROR'],
        },
      },
      targets: [new targets.LambdaFunction(transcodeCompleteFn)],
    });

    // ─── Transcription Lambda Functions ─────────────────────────

    const transcribeTriggerFn = new lambda.Function(this, 'TranscribeTriggerFn', {
      functionName: 'velox-transcribe-trigger',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'transcribe-trigger.handler',
      code: lambda.Code.fromAsset('lambda/transcribe-trigger'),
      role: lambdaProcessingRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        VIDEOS_TABLE: videosTable.tableName,
        S3_BUCKET_TRANSCRIPTS: this.transcriptsBucket.bucketName,
      },
    });

    const transcribeCompleteFn = new lambda.Function(this, 'TranscribeCompleteFn', {
      functionName: 'velox-transcribe-complete',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'transcribe-complete.handler',
      code: lambda.Code.fromAsset('lambda/transcribe-complete'),
      role: lambdaProcessingRole,
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      environment: {
        VIDEOS_TABLE: videosTable.tableName,
        S3_BUCKET_CAPTIONS: this.captionsBucket.bucketName,
        S3_BUCKET_TRANSCRIPTS: this.transcriptsBucket.bucketName,
        CLOUDFRONT_DOMAIN: this.distribution.distributionDomainName,
      },
    });

    // EventBridge rule for Transcribe job completion
    new events.Rule(this, 'TranscribeCompleteRule', {
      ruleName: 'velox-transcribe-complete',
      eventPattern: {
        source: ['aws.transcribe'],
        detailType: ['Transcribe Job State Change'],
        detail: {
          TranscriptionJobStatus: ['COMPLETED', 'FAILED'],
        },
      },
      targets: [new targets.LambdaFunction(transcribeCompleteFn)],
    });

    // ─── Outputs ─────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: 'VeloxUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      exportName: 'VeloxUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: userPoolDomain.domainName,
      exportName: 'VeloxUserPoolDomain',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      exportName: 'VeloxCloudFrontDomain',
    });

    new cdk.CfnOutput(this, 'VideoSourceBucketName', {
      value: this.videoSourceBucket.bucketName,
      exportName: 'VeloxVideoSourceBucket',
    });

    new cdk.CfnOutput(this, 'VideoOutputBucketName', {
      value: this.videoOutputBucket.bucketName,
      exportName: 'VeloxVideoOutputBucket',
    });

    new cdk.CfnOutput(this, 'MediaConvertRoleArn', {
      value: mediaConvertRole.roleArn,
      exportName: 'VeloxMediaConvertRoleArn',
    });

    new cdk.CfnOutput(this, 'LambdaProcessingRoleArn', {
      value: lambdaProcessingRole.roleArn,
      exportName: 'VeloxLambdaProcessingRoleArn',
    });
  }
}
