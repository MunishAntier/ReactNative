-- Fan-out encryption: per-device message delivery

-- 1. Add is_active flag to devices (Rule 22) — idempotent
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'devices' AND COLUMN_NAME = 'is_active');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE devices ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Per-device message recipients table (Rules 4, 23, 24)
CREATE TABLE IF NOT EXISTS message_recipients (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  message_id BIGINT NOT NULL,
  receiver_device_id BIGINT NOT NULL,
  ciphertext BLOB NOT NULL,
  header_json JSON NOT NULL,
  status ENUM('pending','delivered','read','failed') NOT NULL DEFAULT 'pending',
  delivered_at DATETIME,
  read_at DATETIME,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uniq_msg_device (message_id, receiver_device_id),
  KEY idx_mr_device_status (receiver_device_id, status),
  KEY idx_mr_message (message_id),
  CONSTRAINT fk_mr_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_device FOREIGN KEY (receiver_device_id) REFERENCES devices(id)
);

-- 3. Add fan_out flag — idempotent
SET @col_exists2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'fan_out');
SET @sql2 = IF(@col_exists2 = 0, 'ALTER TABLE messages ADD COLUMN fan_out BOOLEAN NOT NULL DEFAULT FALSE', 'SELECT 1');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 4. Index for per-device sync queries (idempotent via IF NOT EXISTS)
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_recipients' AND INDEX_NAME = 'idx_mr_device_created');
SET @sql3 = IF(@idx_exists = 0, 'CREATE INDEX idx_mr_device_created ON message_recipients (receiver_device_id, created_at)', 'SELECT 1');
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
