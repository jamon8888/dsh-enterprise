resource "aws_codebuild_project" "runner" {
  name           = "${local.name_prefix}-runner"
  description    = "Ephemeral privileged Facility sandboxes"
  service_role   = aws_iam_role.codebuild_runner.arn
  encryption_key = aws_kms_key.facility.arn
  build_timeout  = 180
  queued_timeout = 60

  artifacts {
    type = "NO_ARTIFACTS"
  }

  # Fail closed when a caller omits the per-run cache override. Facility gives
  # each project a separate, unguessable S3 prefix at StartBuild time.
  cache {
    type = "NO_CACHE"
  }

  source {
    type      = "NO_SOURCE"
    buildspec = <<-YAML
      version: 0.2
      run-as: root
      phases:
        build:
          commands:
            - /app/codebuild-runner.sh
      cache:
        paths:
          - "/work/.local/share/pnpm/store/**/*"
          - "/work/.npm/_cacache/**/*"
    YAML
  }

  environment {
    compute_type                = "BUILD_GENERAL1_LARGE"
    image                       = local.images.runner
    type                        = var.task_cpu_architecture == "ARM64" ? "ARM_CONTAINER" : "LINUX_CONTAINER"
    image_pull_credentials_type = "SERVICE_ROLE"
    privileged_mode             = true
  }

  logs_config {
    cloudwatch_logs {
      group_name  = aws_cloudwatch_log_group.service["runner"].name
      stream_name = "runner"
    }
  }

  vpc_config {
    vpc_id             = aws_vpc.facility.id
    subnets            = [for subnet in aws_subnet.private : subnet.id]
    security_group_ids = [aws_security_group.sandbox.id]
  }

  tags = {
    Name = "${local.name_prefix}-runner"
  }
}
