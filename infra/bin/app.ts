#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { StorageStack } from "../lib/storage-stack";
import { FilmsStack } from "../lib/films-stack";

const app = new cdk.App();

new StorageStack(app, "CloudPortfolioStorage", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
});

new FilmsStack(app, "CloudPortfolioFilms", {
  description: "soltani.org cinematic homepage: private S3 bucket + CloudFront for scroll-film frames",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
});
