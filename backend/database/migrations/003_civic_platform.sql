-- Civic AI Intelligence & Response Platform - additive migration.
-- Nothing here drops or rewrites existing data: new tables, new nullable/defaulted columns,
-- and composite indexes only. Safe to apply on top of 001 + 002 with live data present.

SET NAMES utf8mb4;

-- Immutable audit trail of significant actions (who / what / when / before / after).
-- Values are sanitised by services/audit/audit.service.js before insert - never secrets.
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL,
  actor_role VARCHAR(20) NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR(40) NULL,
  previous_value JSON NULL,
  new_value JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_actor (actor_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-complaint timeline events that are not plain status changes (AI analysed, duplicate
-- detected, incident linked, reviewed, escalated ...). Merged with complaint_status_history
-- at read time. visibility = PUBLIC events are shown to the citizen; STAFF are internal.
CREATE TABLE IF NOT EXISTS complaint_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  details JSON NULL,
  actor_id INT NULL,
  visibility ENUM('PUBLIC', 'STAFF') NOT NULL DEFAULT 'STAFF',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_complaint_events_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  INDEX idx_complaint_events_complaint (complaint_id, created_at),
  INDEX idx_complaint_events_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The latest decision trace for a complaint: the validated structured AI output, the
-- evidence score + signals, and the ordered list of decision factors that produced the
-- final priority. One row per complaint (re-analysis overwrites; history lives in audit_logs).
CREATE TABLE IF NOT EXISTS complaint_decisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL UNIQUE,
  engine_version VARCHAR(20) NOT NULL,
  ai_output JSON NULL,
  evidence_score TINYINT UNSIGNED NULL,
  evidence_band VARCHAR(20) NULL,
  evidence_signals JSON NULL,
  decision_factors JSON NULL,
  base_priority_score INT NULL,
  final_priority_score INT NULL,
  final_priority_level VARCHAR(20) NULL,
  human_review_required BOOLEAN NOT NULL DEFAULT FALSE,
  review_reasons JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_decisions_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Persisted duplicate / related-complaint suggestions, so staff can confirm or reject them
-- and duplicate precision can be measured. Reports are never deleted.
CREATE TABLE IF NOT EXISTS complaint_duplicates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  related_complaint_id INT NOT NULL,
  duplicate_probability DECIMAL(4,3) NOT NULL,
  semantic_score DECIMAL(4,3) NULL,
  text_score DECIMAL(4,3) NULL,
  distance_meters INT NULL,
  image_similarity DECIMAL(4,3) NULL,
  indicators JSON NULL,
  review_status ENUM('SUGGESTED', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'SUGGESTED',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_duplicate_pair (complaint_id, related_complaint_id),
  CONSTRAINT fk_dup_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  CONSTRAINT fk_dup_related FOREIGN KEY (related_complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  INDEX idx_dup_status (review_status),
  INDEX idx_dup_related (related_complaint_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Human-in-the-loop reviews. Each row records the AI/system value next to the human value
-- so agreement can be measured. Used as evaluation data only - nothing retrains from it.
CREATE TABLE IF NOT EXISTS human_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  reviewer_id INT NOT NULL,
  action VARCHAR(30) NOT NULL,
  ai_category VARCHAR(50) NULL,
  human_category VARCHAR(50) NULL,
  ai_priority_level VARCHAR(20) NULL,
  human_priority_level VARCHAR(20) NULL,
  ai_department_id INT NULL,
  human_department_id INT NULL,
  notes VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  INDEX idx_reviews_complaint (complaint_id),
  INDEX idx_reviews_action (action),
  INDEX idx_reviews_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Configurable SLA policy. category_key '*' is the default for a priority level; a specific
-- category row overrides it. Falls back to utils/constants.js when a row is absent.
CREATE TABLE IF NOT EXISTS sla_policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  priority_level VARCHAR(20) NOT NULL,
  category_key VARCHAR(50) NOT NULL DEFAULT '*',
  target_hours INT NOT NULL,
  warning_pct DECIMAL(3,2) NOT NULL DEFAULT 0.80,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sla_policy (priority_level, category_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sla_policies (priority_level, category_key, target_hours, warning_pct) VALUES
  ('CRITICAL', '*', 12, 0.80),
  ('HIGH', '*', 24, 0.80),
  ('MEDIUM', '*', 48, 0.80),
  ('LOW', '*', 72, 0.80);

-- Rule-based escalation events (SLA, severity, repeat, incident, surge). dedupe_key makes
-- each rule fire at most once per subject until the event is resolved.
CREATE TABLE IF NOT EXISTS escalation_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_code VARCHAR(40) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  complaint_id INT NULL,
  incident_id INT NULL,
  department_id INT NULL,
  title VARCHAR(255) NOT NULL,
  details JSON NULL,
  status ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
  dedupe_key VARCHAR(120) NOT NULL,
  acknowledged_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  UNIQUE KEY uq_escalation_dedupe (dedupe_key),
  INDEX idx_escalation_status (status, created_at),
  INDEX idx_escalation_complaint (complaint_id),
  INDEX idx_escalation_incident (incident_id),
  INDEX idx_escalation_rule (rule_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Every OpenAI call: use case, model, tokens, estimated cost, latency, outcome.
CREATE TABLE IF NOT EXISTS ai_usage (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  use_case VARCHAR(60) NOT NULL,
  model VARCHAR(60) NOT NULL,
  prompt_tokens INT NULL,
  completion_tokens INT NULL,
  total_tokens INT NULL,
  estimated_cost_usd DECIMAL(12,6) NULL,
  latency_ms INT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_usage_created (created_at),
  INDEX idx_ai_usage_use_case (use_case, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI evaluation runs: expected vs actual per labelled test case.
CREATE TABLE IF NOT EXISTS ai_evaluations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  run_id VARCHAR(40) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  task VARCHAR(30) NOT NULL,
  case_id VARCHAR(60) NOT NULL,
  expected JSON NULL,
  actual JSON NULL,
  agreed BOOLEAN NOT NULL,
  confidence DECIMAL(4,3) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_eval_run (run_id),
  INDEX idx_ai_eval_task (task, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Background job execution history.
CREATE TABLE IF NOT EXISTS job_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_name VARCHAR(60) NOT NULL,
  status ENUM('SUCCESS', 'FAILED') NOT NULL,
  duration_ms INT NOT NULL,
  details JSON NULL,
  error_message VARCHAR(255) NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_job_runs_name (job_name, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Image intelligence computed locally at upload time (perceptual hash + quality metrics).
ALTER TABLE complaint_images
  ADD COLUMN phash CHAR(16) NULL,
  ADD COLUMN blur_score DECIMAL(10,2) NULL,
  ADD COLUMN brightness DECIMAL(5,2) NULL,
  ADD COLUMN width INT NULL,
  ADD COLUMN height INT NULL,
  ADD INDEX idx_images_phash (phash);

-- Complaint-level additions + composite indexes for the analytics/dashboard queries.
ALTER TABLE complaints
  ADD COLUMN sla_hours INT NULL,
  ADD COLUMN review_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN ai_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ADD INDEX idx_complaints_status_created (status, created_at),
  ADD INDEX idx_complaints_category_created (category, created_at),
  ADD INDEX idx_complaints_dept_status (department_id, status),
  ADD INDEX idx_complaints_sla (sla_status),
  ADD INDEX idx_complaints_review (review_required, review_status);
