import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";

/**
 * Public, credential-less hosting for the homepage scroll films
 * (public/films/<name>/<width>/f_NNNN.webp, built by scripts/films/build-film.sh and
 * uploaded by scripts/films/sync-film.sh under films/<name>/).
 *
 * Frames are immutable per film name, so the bucket stays private (CloudFront OAC only) and
 * the distribution caches each object by its own Cache-Control. CORS is `*` at the edge on
 * every response so a cached non-CORS hit can never poison a crossOrigin (WebGL) load.
 */
export class FilmsStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "FilmsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // S3-managed keys: KMS + OAC would turn every cache miss into a KMS call for public content.
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      cors: [
        {
          // Public credential-less assets: an origin allowlist on a cached asset is the classic
          // cached-variant bug, so S3 answers CORS for any origin and the edge policy enforces `*`.
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],

      // Frames are the product of paid generations: keep the bucket if the stack is ever deleted.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "films-maintenance",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    const responseHeaders = new cloudfront.ResponseHeadersPolicy(this, "FilmsResponseHeaders", {
      comment: "Always-on CORS for public film frames, applied at the edge on cache hits too",
      corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ["*"],
        accessControlAllowMethods: ["GET", "HEAD", "OPTIONS"],
        accessControlAllowOrigins: ["*"],
        originOverride: true,
      },
      customHeadersBehavior: {
        customHeaders: [
          // Lets a cross-origin page (scroll-qa on localhost) read transfer sizes via Resource Timing.
          { header: "Timing-Allow-Origin", value: "*", override: true },
        ],
      },
    });

    this.distribution = new cloudfront.Distribution(this, "FilmsDistribution", {
      comment: "soltani.org scroll-film frames",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
          originAccessLevels: [cloudfront.AccessLevel.READ],
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        // Honours each object's Cache-Control (frames: immutable; manifest: max-age=300).
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        responseHeadersPolicy: responseHeaders,
        // WebP is already compressed; edge gzip/brotli would only cost CPU and a Vary header.
        compress: false,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableIpv6: true,
      // No errorResponses: a missing frame is a 403 and <ScrollFilm> covers it with neighbours.
      // Alias-ready later by adding `certificate` + `domainNames`; the /films/<name>/ layout stays.
    });

    cdk.Tags.of(this).add("Project", "cloud-portfolio");
    cdk.Tags.of(this).add("Component", "films");

    new cdk.CfnOutput(this, "FilmsBucketName", { value: this.bucket.bucketName });
    new cdk.CfnOutput(this, "FilmsDistributionId", { value: this.distribution.distributionId });
    new cdk.CfnOutput(this, "FilmsDistributionDomainName", {
      value: this.distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "FilmsBaseUrl", {
      value: `https://${this.distribution.distributionDomainName}/films`,
    });
  }
}
