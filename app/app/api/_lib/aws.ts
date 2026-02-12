import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const REGION = mustEnv("AWS_REGION");

// One client per process
const ddb = new DynamoDBClient({ region: REGION });

// Document client for nice JS objects
export const ddbDoc = DynamoDBDocumentClient.from(ddb, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_NAME = mustEnv("SECURE_DOC_TABLE");
