import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";

export class StorageStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly rawBucket: s3.Bucket;
  public readonly outputBucket: s3.Bucket;
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // KMS key for both buckets
    this.kmsKey = new kms.Key(this, "SecureDocKmsKey", {
      enableKeyRotation: true,
    });

    // DynamoDB single-table design starter
    this.table = new dynamodb.Table(this, "SecureDocAppTable", {
      tableName: "SecureDocApp",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

      // NEW API (replaces deprecated pointInTimeRecovery: true)
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

      // DEV ONLY (safe to remove later)
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

      // DEV ONLY
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Useful outputs for later stacks / debugging
    new cdk.CfnOutput(this, "SecureDocTableName", {
      value: this.table.tableName,
    });

    new cdk.CfnOutput(this, "RawBucketName", {
      value: this.rawBucket.bucketName,
    });

    new cdk.CfnOutput(this, "OutputBucketName", {
      value: this.outputBucket.bucketName,
    });

    new cdk.CfnOutput(this, "KmsKeyArn", {
      value: this.kmsKey.keyArn,
    });
  }
}
