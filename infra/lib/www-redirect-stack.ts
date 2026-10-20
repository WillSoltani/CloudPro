import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";

const APEX_DOMAIN = "soltani.org";
const WWW_DOMAIN = `www.${APEX_DOMAIN}`;

/**
 * cloudfront-js-2.0 viewer-request handler. Every request (http or https, any path) gets one 301
 * straight to the apex with the path and query string kept as received (repeated keys and bare
 * flags included), so nothing ever reaches the origin. max-age=86400 rather than a bare 301,
 * which browsers cache indefinitely: the redirect stays reversible within a day.
 */
export const WWW_REDIRECT_FUNCTION_CODE = `function handler(event) {
  var request = event.request;
  var qs = request.querystring;
  var parts = [];
  for (var key in qs) {
    var item = qs[key];
    var values = item.multiValue ? item.multiValue : [item];
    for (var i = 0; i < values.length; i++) {
      var v = values[i].value;
      parts.push(v === "" ? key : key + "=" + v);
    }
  }
  var location = ${JSON.stringify(`https://${APEX_DOMAIN}`)} + request.uri + (parts.length ? "?" + parts.join("&") : "");
  return {
    statusCode: 301,
    statusDescription: "Moved Permanently",
    headers: {
      location: { value: location },
      "cache-control": { value: "public, max-age=86400" },
    },
  };
}
`;

/**
 * www.soltani.org -> https://soltani.org, answered at the CloudFront edge.
 *
 * soltani.org itself is App Runner (cloudpro-web) and is never referenced: this stack only adds a
 * dedicated www certificate, a distribution whose viewer-request function answers every request
 * with a 301, and the www A/AAAA alias records. Deleting the stack returns www to NXDOMAIN.
 *
 * The zone is imported by attributes (no lookup), so `cdk synth` needs no AWS credentials. Its id
 * comes from `SOLTANI_HOSTED_ZONE_ID` when set, else the `soltaniHostedZoneId` context in cdk.json.
 */
export class WwwRedirectStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const hostedZoneId: unknown =
      process.env.SOLTANI_HOSTED_ZONE_ID || this.node.tryGetContext("soltaniHostedZoneId");
    if (typeof hostedZoneId !== "string" || !/^Z[A-Z0-9]{8,32}$/.test(hostedZoneId)) {
      throw new Error(
        "WwwRedirectStack: set the soltaniHostedZoneId context (infra/cdk.json) or SOLTANI_HOSTED_ZONE_ID to the soltani.org Route 53 zone id.",
      );
    }

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId,
      zoneName: APEX_DOMAIN,
    });

    // Dedicated certificate: the existing *.soltani.org one belongs to the Cognito auth domain.
    // CloudFormation writes the validation CNAME into the zone and waits for ISSUED.
    const certificate = new acm.Certificate(this, "WwwCertificate", {
      domainName: WWW_DOMAIN,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    const redirectFn = new cloudfront.Function(this, "WwwRedirectFunction", {
      comment: `${WWW_DOMAIN} 301 to https://${APEX_DOMAIN}, path and query kept`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(WWW_REDIRECT_FUNCTION_CODE),
    });

    this.distribution = new cloudfront.Distribution(this, "WwwRedirectDistribution", {
      comment: `${WWW_DOMAIN} redirect to the apex`,
      domainNames: [WWW_DOMAIN],
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        // Required by CloudFront but never contacted: the viewer-request function always responds.
        origin: new origins.HttpOrigin(APEX_DOMAIN),
        // ALLOW_ALL so http://www... is one hop to https://soltani.org, not two.
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        functionAssociations: [
          { function: redirectFn, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableIpv6: true,
    });

    const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution));
    new route53.ARecord(this, "WwwAlias", { zone, recordName: "www", target });
    new route53.AaaaRecord(this, "WwwAliasIpv6", { zone, recordName: "www", target });

    cdk.Tags.of(this).add("Project", "cloud-portfolio");
    cdk.Tags.of(this).add("Component", "www-redirect");

    new cdk.CfnOutput(this, "WwwDistributionId", { value: this.distribution.distributionId });
    new cdk.CfnOutput(this, "WwwDistributionDomainName", {
      value: this.distribution.distributionDomainName,
    });
  }
}
