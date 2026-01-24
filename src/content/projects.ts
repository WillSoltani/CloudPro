export type CaseStudy = {
  problem: string;
  approach: string;
  architecture: {
    overview: string;
    services: { name: string; why: string }[];
  };
  security: string[];
  reliability: string[];
  observability: string[];
  cost: string[];
  demoNotes?: string[];
};

export type Project = {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  featured?: boolean;
  liveUrl?: string;
  repoUrl?: string;
  diagramPath?: string; // e.g. "/diagrams/file-pipeline.png"
  caseStudy: CaseStudy;
};

export const projects: Project[] = [
  {
    slug: "serverless-file-pipeline",
    title: "Serverless File Processing Pipeline",
    summary:
      "Upload files via presigned URLs, run a configurable pipeline (convert, extract, transform), and track status with events and durable orchestration.",
    tags: ["S3", "Lambda", "Step Functions", "EventBridge", "DynamoDB", "CloudWatch"],
    featured: true,
    liveUrl: "#",
    repoUrl: "#",
    diagramPath: "/diagrams/file-pipeline.png",
    caseStudy: {
      problem:
        "Users need a fast, safe way to upload files and run multi-step processing without tying up servers or risking runaway costs.",
      approach:
        "Use S3 presigned uploads for throughput, Step Functions for durable orchestration, event-driven triggers for decoupling, and DynamoDB for status tracking.",
      architecture: {
        overview:
          "Clients upload to S3 using short-lived presigned URLs. An event triggers ingestion, Step Functions orchestrates each stage, and status is persisted for the UI.",
        services: [
          { name: "S3", why: "Durable storage + cheap + native event triggers." },
          { name: "Step Functions", why: "Durable workflow orchestration with retries/timeouts." },
          { name: "Lambda", why: "Serverless compute for per-step transforms." },
          { name: "EventBridge", why: "Decoupled events + extensibility for new steps." },
          { name: "DynamoDB", why: "Low-latency status store for jobs and progress." },
          { name: "CloudWatch", why: "Logs, metrics, alarms, dashboards." },
        ],
      },
      security: [
        "Presigned URLs with strict TTL + content-type allowlist + size limits.",
        "Least-privilege IAM per function with scoped S3 prefixes and DynamoDB items.",
        "Encryption at rest (S3 SSE, DynamoDB) and TLS in transit.",
        "Secrets stored in SSM/Secrets Manager (no secrets in repo).",
      ],
      reliability: [
        "Idempotency keys to avoid double-processing on retries.",
        "Step Functions retries with exponential backoff and per-step timeouts.",
        "Dead-letter handling or quarantine prefix for failed jobs.",
        "Alarms on error rate and workflow failures.",
      ],
      observability: [
        "Structured JSON logs with correlation/job IDs.",
        "Metrics: job count, success/failure, step latency, queue depth (if used).",
        "Dashboards for throughput and error spikes.",
      ],
      cost: [
        "S3 lifecycle rules to expire uploads/outputs after N days.",
        "Lambda concurrency limits to cap spend during spikes.",
        "Step Functions limits and short payloads to avoid unnecessary state transitions.",
      ],
      demoNotes: [
        "Public demo uses strict rate limits and file size caps.",
        "Uploads go to a sandbox prefix; outputs auto-expire.",
      ],
    },
  },

  {
    slug: "api-auth-template",
    title: "Secure API + Auth Template",
    summary:
      "A production-style starter for JWT auth, rate limits, CORS, structured logs, and alarms. Built to be reused across future apps.",
    tags: ["API Gateway", "Lambda", "Cognito", "WAF", "CloudWatch"],
    featured: true,
    liveUrl: "#",
    repoUrl: "#",
    diagramPath: "/diagrams/api-auth.png",
    caseStudy: {
      problem:
        "Most personal projects skip auth, rate limits, and monitoring. This template makes secure defaults reusable.",
      approach:
        "JWT-based auth, API Gateway protections, consistent request logging, and alarms from day one.",
      architecture: {
        overview:
          "Clients authenticate, call an API Gateway endpoint, Lambda handles business logic, and CloudWatch captures logs/metrics.",
        services: [
          { name: "Cognito", why: "Managed auth with JWTs." },
          { name: "API Gateway", why: "Front door for auth, throttling, and routing." },
          { name: "Lambda", why: "Business logic with minimal ops." },
          { name: "WAF", why: "Basic edge protections against common abuse." },
          { name: "CloudWatch", why: "Alarms + logs + dashboards." },
        ],
      },
      security: [
        "JWT validation and scoped claims-based authorization.",
        "CORS allowlist per environment.",
        "Secrets stored in SSM/Secrets Manager.",
      ],
      reliability: [
        "Time-bounded requests and safe retry behavior where appropriate.",
        "Alarms for 4xx/5xx anomalies and latency spikes.",
      ],
      observability: [
        "Structured logs with request IDs and user identifiers.",
        "Dashboards for latency/error rate and per-route traffic.",
      ],
      cost: [
        "WAF rules and API throttles to reduce abuse-driven cost.",
        "Right-sized logging and retention policies.",
      ],
    },
  },

  {
    slug: "ecs-microservices",
    title: "ECS/Fargate Microservices",
    summary:
      "Containerized services behind an ALB with health checks and CI/CD. Designed for predictable deploys and scaling.",
    tags: ["ECS", "Fargate", "ECR", "ALB", "GitHub Actions"],
    featured: false,
    liveUrl: "#",
    repoUrl: "#",
    diagramPath: "/diagrams/ecs.png",
    caseStudy: {
      problem:
        "Some workloads need long-running processes and predictable deployments with containers.",
      approach:
        "Use ECS/Fargate for managed containers, ALB for routing and health checks, and CI/CD for repeatable deploys.",
      architecture: {
        overview:
          "Requests hit an ALB, route to ECS services, images live in ECR, and deployment is automated via CI/CD.",
        services: [
          { name: "ECS/Fargate", why: "Managed containers with less ops burden." },
          { name: "ALB", why: "Routing + health checks + scaling integration." },
          { name: "ECR", why: "Private image registry integrated with ECS." },
          { name: "CloudWatch", why: "Logs and alarms for services." },
        ],
      },
      security: [
        "Least-privilege task roles per service.",
        "Private subnets for tasks where possible; ALB is the public entry point.",
      ],
      reliability: [
        "Health checks and rolling deployments.",
        "Auto scaling based on CPU/requests.",
      ],
      observability: [
        "Service logs + metrics and alarms.",
      ],
      cost: [
        "Right-size tasks and scale based on load.",
      ],
    },
  },
];
