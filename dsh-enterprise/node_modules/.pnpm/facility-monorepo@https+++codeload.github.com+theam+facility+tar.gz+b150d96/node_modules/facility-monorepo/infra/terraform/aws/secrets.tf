resource "aws_secretsmanager_secret" "app" {
  for_each = local.app_secret_names

  name                    = "${local.name_prefix}/${each.key}"
  description             = "Facility ${var.environment} ${each.key} value. Populate out-of-band; Terraform does not store secret values."
  kms_key_id              = aws_kms_key.facility.arn
  recovery_window_in_days = 7
}
