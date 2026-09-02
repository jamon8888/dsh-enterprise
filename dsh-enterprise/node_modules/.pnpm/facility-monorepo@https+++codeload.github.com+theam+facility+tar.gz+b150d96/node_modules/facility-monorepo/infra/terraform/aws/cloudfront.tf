data "aws_cloudfront_cache_policy" "caching_disabled" {
  count = var.enable_cloudfront_api_endpoint || local.managed_preview_origin ? 1 : 0

  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  count = var.enable_cloudfront_api_endpoint || local.managed_preview_origin ? 1 : 0

  name = "Managed-AllViewerExceptHostHeader"
}

# This value classifies traffic at the shared API tasks; it is not a user or
# provider credential. Keeping it unguessable prevents direct-origin callers
# from making untrusted preview HTML render on a control-plane hostname.
resource "random_password" "preview_surface" {
  count   = local.managed_preview_origin ? 1 : 0
  length  = 64
  special = false
}

resource "aws_cloudfront_distribution" "preview" {
  count = local.managed_preview_origin ? 1 : 0

  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.name_prefix} isolated preview origin"
  price_class     = "PriceClass_100"
  http_version    = "http2and3"

  origin {
    # A configured API hostname lets CloudFront verify the ALB certificate and
    # also supplies the Host value consumed by the existing API listener rule.
    # Certificate-less validation stacks use the ALB address over HTTP.
    domain_name = var.acm_certificate_arn == "" ? aws_lb.public.dns_name : var.api_hostname
    origin_id   = "${local.name_prefix}-preview-api"

    custom_header {
      name  = "X-Facility-Preview-Surface"
      value = random_password.preview_surface[0].result
    }

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = var.acm_certificate_arn == "" ? "http-only" : "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "${local.name_prefix}-preview-api"
    viewer_protocol_policy = "redirect-to-https"

    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD"]

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled[0].id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host[0].id
    compress                 = false
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # AWS owns and renews the *.cloudfront.net certificate. cloudfront.net is
    # on the Public Suffix List, so one distribution cannot set cookies for a
    # sibling distribution or for the Facility control-plane site.
    minimum_protocol_version = "TLSv1"
  }

  depends_on = [aws_lb_listener.http, aws_lb_listener.https]
}

resource "aws_cloudfront_distribution" "api" {
  count = var.enable_cloudfront_api_endpoint ? 1 : 0

  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.name_prefix} API validation endpoint"
  price_class     = "PriceClass_100"
  http_version    = "http2and3"

  origin {
    domain_name = aws_lb.public.dns_name
    origin_id   = "${local.name_prefix}-api-alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "${local.name_prefix}-api-alb"
    viewer_protocol_policy = "redirect-to-https"

    allowed_methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods  = ["GET", "HEAD"]

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled[0].id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host[0].id
    compress                 = false
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # AWS fixes the default *.cloudfront.net certificate policy to TLSv1. A
    # custom domain and ACM certificate are required to enforce TLSv1.2_2021.
    minimum_protocol_version = "TLSv1"
  }

  lifecycle {
    precondition {
      condition     = var.acm_certificate_arn == ""
      error_message = "enable_cloudfront_api_endpoint requires acm_certificate_arn to be empty because its ALB origin uses certificate-less HTTP forwarding."
    }
  }

  depends_on = [aws_lb_listener.http]
}
