resource "aws_db_subnet_group" "facility" {
  name       = local.name_prefix
  subnet_ids = [for subnet in aws_subnet.private : subnet.id]

  tags = {
    Name = "${local.name_prefix}-db-subnets"
  }
}

resource "aws_db_instance" "postgres" {
  identifier = "${local.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.database_instance_class

  allocated_storage     = var.database_allocated_storage_gb
  max_allocated_storage = max(var.database_allocated_storage_gb, 100)
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.facility.arn

  db_name  = var.database_name
  username = var.database_username

  manage_master_user_password   = true
  master_user_secret_kms_key_id = aws_kms_key.facility.arn

  db_subnet_group_name   = aws_db_subnet_group.facility.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false

  backup_retention_period   = var.database_backup_retention_days
  deletion_protection       = var.enable_deletion_protection
  skip_final_snapshot       = !var.enable_deletion_protection
  final_snapshot_identifier = var.enable_deletion_protection ? null : "${local.name_prefix}-final"

  tags = {
    Name = "${local.name_prefix}-postgres"
  }
}
