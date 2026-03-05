// infra/lib/storage-stack.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
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
          allowedOrigins: ["http://localhost:3000"],
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
          allowedOrigins: ["http://localhost:3000"],
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

    /**
     * IMPORTANT:
     * When CDK executes, it runs the compiled JS from infra/dist/.
     * __dirname will be ".../infra/dist/lib" at synth time.
     * So we hop back up to ".../infra" and reference the *source* TS file.
     */
    const infraRoot = path.resolve(__dirname, "..", ".."); // -> infra/
    const workerEntry = path.join(infraRoot, "lib", "lambdas", "convert-worker", "index.ts");
    const lockFile = path.join(infraRoot, "lib", "lambdas", "convert-worker", "package-lock.json");    // Convert Worker Lambda (Sharp)
    // --------------------------
    this.convertWorker = new lambdaNodejs.NodejsFunction(this, "ConvertWorker", {
      runtime: lambda.Runtime.NODEJS_20_X,

      /**
       * Keep x86_64 for now to avoid sharp-linux-arm64 packaging pain.
       * (You can switch to ARM later once everything is stable.)
       */
      architecture: lambda.Architecture.X86_64,

      entry: workerEntry,
      handler: "handler",

      /**
       * NodejsFunction will run `npm ci` during bundling using this lockfile.
       * If sharp versions drift, bundling will fail. We will fix that next.
       */
      depsLockFilePath: lockFile,

      memorySize: 1024,
      timeout: cdk.Duration.minutes(2),

      bundling: {
        forceDockerBundling: true,

        /**
         * Force bundling for Amazon Linux x86_64 so sharp matches Lambda.
         */
        platform: "linux/amd64",

        /**
         * Don't bundle AWS SDK (provided in Lambda runtime). Keep bundle small.
         */
        externalModules: ["@aws-sdk/*"],

        /**
         * Install sharp in the bundle so native binary exists in /var/task/node_modules/sharp
         */
        nodeModules: ["sharp"],
      },

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

    this.convertStateMachine = new sfn.StateMachine(this, "ConvertStateMachine", {
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