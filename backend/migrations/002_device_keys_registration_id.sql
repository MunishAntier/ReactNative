SET @registration_id_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'device_keys'
    AND COLUMN_NAME = 'registration_id'
);

SET @add_registration_id_sql := IF(
  @registration_id_exists = 0,
  'ALTER TABLE device_keys ADD COLUMN registration_id INT NOT NULL DEFAULT 1 AFTER device_id',
  'SELECT 1'
);

PREPARE add_registration_id_stmt FROM @add_registration_id_sql;
EXECUTE add_registration_id_stmt;
DEALLOCATE PREPARE add_registration_id_stmt;
