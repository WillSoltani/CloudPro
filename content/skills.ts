export type SkillCategory = {
    title: string;
    items: string[];
  };
  
  export const skillCategories: SkillCategory[] = [
    {
      title: "AWS Serverless",
      items: ["Lambda", "API Gateway", "Step Functions", "EventBridge", "S3", "SQS", "SNS"],
    },
    {
      title: "Databases",
      items: ["DynamoDB", "RDS", "Aurora", "ElastiCache (basic)", "DMS (basic)"],
    },
    {
      title: "Containers",
      items: ["ECS", "Fargate", "ECR", "ALB", "Cloud Map (basic)"],
    },
    {
      title: "IaC & CI/CD",
      items: ["CloudFormation", "CDK (learning)", "Terraform (optional)", "GitHub Actions"],
    },
    {
      title: "Observability",
      items: ["CloudWatch Logs", "CloudWatch Metrics", "Alarms", "X-Ray (basic)"],
    },
    {
      title: "Security",
      items: ["IAM (least privilege)", "KMS", "Secrets Manager / SSM", "WAF (basic)", "Cognito (basic)"],
    },
  ];
  