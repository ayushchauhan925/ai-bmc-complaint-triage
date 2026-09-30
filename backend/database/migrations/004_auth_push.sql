-- Account security + web push. Additive only.

SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN email_verified_at DATETIME NULL,
  ADD COLUMN failed_login_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN locked_until DATETIME NULL;

-- One-time tokens for password reset and email verification. Only a SHA-256 hash of the
-- token is stored, so a database leak cannot be used to reset anyone's password.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  purpose ENUM('PASSWORD_RESET', 'EMAIL_VERIFY') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auth_token_hash (token_hash),
  INDEX idx_auth_tokens_user (user_id, purpose),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Browser push subscriptions (Web Push). endpoint_hash makes the long endpoint URL uniquely indexable.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint TEXT NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_push_endpoint (endpoint_hash),
  INDEX idx_push_user (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
