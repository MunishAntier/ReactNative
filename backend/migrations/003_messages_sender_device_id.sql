SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'messages' AND column_name = 'sender_device_id');
SET @stmt = IF(@col_exists = 0, 'ALTER TABLE messages ADD COLUMN sender_device_id BIGINT NOT NULL DEFAULT 1 AFTER sender_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
