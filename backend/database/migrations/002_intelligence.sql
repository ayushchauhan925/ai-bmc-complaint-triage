-- Phase 2: Civic Intelligence upgrade.
-- Adds AI-enrichment columns to complaints, and new tables for incident timeline,
-- SLA escalation history, reopen tracking, AI situation reports and admin NL-search audit.

SET NAMES utf8mb4;

ALTER TABLE complaints
  ADD COLUMN ai_title VARCHAR(255) NULL AFTER description,
  ADD COLUMN missing_information JSON NULL AFTER severity_signals,
  ADD COLUMN evidence_analysis JSON NULL AFTER missing_information,
  ADD COLUMN evidence_confidence DECIMAL(4,3) NULL AFTER evidence_analysis,
  ADD COLUMN resolution_verification JSON NULL AFTER evidence_confidence,
  ADD COLUMN resolution_verification_status VARCHAR(20) NULL AFTER resolution_verification,
  ADD COLUMN ai_officer_checklist JSON NULL AFTER resolution_verification_status;

-- complaint_images.image_type needs a REOPEN value for reopen-flow evidence photos.
ALTER TABLE complaint_images
  MODIFY COLUMN image_type ENUM('ORIGINAL', 'RESOLUTION', 'REOPEN') NOT NULL DEFAULT 'ORIGINAL';

-- Incident timeline: created, complaint linked/unlinked, status changed, merged, escalated.
CREATE TABLE IF NOT EXISTS incident_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  incident_id INT NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  notes VARCHAR(500) NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_incident_events_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  CONSTRAINT fk_incident_events_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_incident_events_incident (incident_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SLA escalation history (Section 14 / 6). One row per notified transition, so repeated
-- checks don't re-notify for the same threshold.
CREATE TABLE IF NOT EXISTS sla_escalations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  from_sla_status VARCHAR(30) NULL,
  to_sla_status VARCHAR(30) NOT NULL,
  notified_user_id INT NULL,
  notified_role VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sla_escalations_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  CONSTRAINT fk_sla_escalations_user FOREIGN KEY (notified_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_sla_escalations_complaint (complaint_id),
  INDEX idx_sla_escalations_status (to_sla_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Citizen "not actually resolved" reopen history (Section 17), distinct from generic
-- status history so the reason/evidence photo has dedicated fields.
CREATE TABLE IF NOT EXISTS complaint_reopenings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  user_id INT NOT NULL,
  reason VARCHAR(1000) NULL,
  image_url VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reopenings_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  CONSTRAINT fk_reopenings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reopenings_complaint (complaint_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI-generated situation reports (Section 11), built only from verified aggregated stats
-- (stats_snapshot) that are passed to the model - never invented by it.
CREATE TABLE IF NOT EXISTS ai_situation_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  generated_by INT NULL,
  summary TEXT NOT NULL,
  stats_snapshot JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_situation_reports_user FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_situation_reports_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit trail for the AI admin natural-language search (Section 9): the raw query, the
-- constrained filter object the AI produced, and how many rows it matched. Never stores
-- executable SQL - the filter JSON is always validated against an allowlist before use.
CREATE TABLE IF NOT EXISTS ai_admin_queries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  query_text VARCHAR(500) NOT NULL,
  filters_json JSON NOT NULL,
  result_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_queries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_admin_queries_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
