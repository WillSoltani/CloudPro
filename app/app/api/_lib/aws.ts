// app/app/api/_lib/aws.ts
import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";

export function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "ca-central-1";


// DynamoDB
const ddb = new DynamoDBClient({ region: REGION });

export const ddbDoc = DynamoDBDocumentClient.from(ddb, {
  marshallOptions: { removeUndefinedValues: true },
});

// Keep your existing env var name
export const TABLE_NAME: string = mustEnv("SECURE_DOC_TABLE");

// S3
export const s3 = new S3Client({ region: REGION });
