"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
class StorageStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.StorageStack = StorageStack;
