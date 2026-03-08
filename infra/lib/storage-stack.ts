// infra/lib/storage-stack.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as lambda from "aws-cdk-lib/aws-lambda";

import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as sfnTasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as path from "path";

export class StorageStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly rawBucket: s3.Bucket;
  public readonly outputBucket: s3.Bucket;
  public readonly kmsKey: kms.Key;

  public readonly convertWorker: lambda.Function;
  public readonly convertStateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // KMS key for both buckets
    this.kmsKey = new kms.Key(this, "SecureDocKmsKey", {
      enableKeyRotation: true,
    });

    // DynamoDB
    this.table = new dynamodb.Table(this, "SecureDocAppTable", {
      tableName: "SecureDocApp",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },

      // DEV ONLY
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3: raw uploads
    this.rawBucket = new s3.Bucket(this, "RawUploadsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedOrigins: ["http://localhost:3000", "https://soltani.org", "https://www.soltani.org"],
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],

      // DEV ONLY
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // S3: outputs
    this.outputBucket = new s3.Bucket(this, "OutputsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedOrigins: ["http://localhost:3000", "https://soltani.org", "https://www.soltani.org"],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],

      // DEV ONLY
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // With ts-node, __dirname is infra/lib — go up one level to reach infra/
    const infraRoot = path.resolve(__dirname, "..");
    const workerDir = path.join(infraRoot, "lib", "lambdas", "convert-worker");

    // Convert Worker Lambda — container image to support large native deps
    // (pdfjs-dist alone is ~220 MB unzipped, exceeding the 250 MB zip limit)
    // --------------------------
    this.convertWorker = new lambda.DockerImageFunction(this, "ConvertWorker", {
      code: lambda.DockerImageCode.fromImageAsset(workerDir),

      /**
       * x86_64 matches the linux/amd64 platform in the Dockerfile.
       * Native packages (sharp, @napi-rs/canvas) are compiled for linux-x64-gnu.
       */
      architecture: lambda.Architecture.X86_64,

      memorySize: 2048,
      timeout: cdk.Duration.minutes(2),

      environment: {
        SECURE_DOC_TABLE: this.table.tableName,
        RAW_BUCKET: this.rawBucket.bucketName,
        OUTPUT_BUCKET: this.outputBucket.bucketName,
      },
    });

    // permissions for worker
    this.table.grantReadWriteData(this.convertWorker);
    this.rawBucket.grantRead(this.convertWorker);
    this.outputBucket.grantWrite(this.convertWorker);
    this.kmsKey.grantEncryptDecrypt(this.convertWorker);

    // --------------------------
    // Step Functions: single-task state machine (v1)
    // --------------------------
    const invokeWorker = new sfnTasks.LambdaInvoke(this, "InvokeConvertWorker", {
      lambdaFunction: this.convertWorker,
      payloadResponseOnly: true,
      retryOnServiceExceptions: true,
    });

    // Retry transient Lambda failures (throttling, service errors) up to 2 times
    invokeWorker.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"],
      maxAttempts: 2,
      interval: cdk.Duration.seconds(2),
      backoffRate: 2,
    });

    this.convertStateMachine = new sfn.StateMachine(this, "ConvertStateMachine", {
      stateMachineType: sfn.StateMachineType.STANDARD,
      definitionBody: sfn.DefinitionBody.fromChainable(invokeWorker),
      timeout: cdk.Duration.minutes(5),
    });

    // Outputs
    new cdk.CfnOutput(this, "SecureDocTableName", { value: this.table.tableName });
    new cdk.CfnOutput(this, "RawBucketName", { value: this.rawBucket.bucketName });
    new cdk.CfnOutput(this, "OutputBucketName", { value: this.outputBucket.bucketName });
    new cdk.CfnOutput(this, "KmsKeyArn", { value: this.kmsKey.keyArn });

    new cdk.CfnOutput(this, "ConvertStateMachineArn", {
      value: this.convertStateMachine.stateMachineArn,
    });
  }
}