-- Department catalog + officer management support. Additive; existing department ids are kept
-- (complaints/users/incidents reference them), so no complaint or user is re-pointed or lost.

SET NAMES utf8mb4;

ALTER TABLE departments
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN contact_email VARCHAR(190) NULL,
  ADD COLUMN contact_phone VARCHAR(30) NULL,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Officers belong to a ward (optional) and can be deactivated without deleting their history.
ALTER TABLE users
  ADD COLUMN ward_id INT NULL,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD INDEX idx_users_dept_active (department_id, is_active),
  ADD CONSTRAINT fk_users_ward FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE SET NULL;

-- Two legacy codes are renamed to the catalog's stable codes (same row, same id).
UPDATE departments SET code = 'PUBLIC_HEALTH' WHERE code = 'SANITATION'
  AND NOT EXISTS (SELECT 1 FROM (SELECT code FROM departments WHERE code = 'PUBLIC_HEALTH') x);
UPDATE departments SET code = 'GENERAL_CIVIC' WHERE code = 'GENERAL'
  AND NOT EXISTS (SELECT 1 FROM (SELECT code FROM departments WHERE code = 'GENERAL_CIVIC') x);

-- Refresh legacy seed names/descriptions ONLY while they still equal the old seed value, so a
-- name an admin has customised is never overwritten.
UPDATE departments SET name = 'Roads & Traffic Infrastructure', description = 'Road surface, potholes, footpaths, signage and road markings' WHERE code = 'ROADS' AND name = 'Roads Department';
UPDATE departments SET name = 'Water Supply', description = 'Water supply, pressure, quality and pipe damage' WHERE code = 'WATER' AND name = 'Water Supply Department';
UPDATE departments SET name = 'Storm Water Drainage', description = 'Storm drains, blocked drains and waterlogging' WHERE code = 'DRAINAGE' AND name = 'Drainage & Sewerage';
UPDATE departments SET name = 'Street Lighting & Electrical Infrastructure', description = 'Streetlights, dark streets and exposed public electrical wiring' WHERE code = 'ELECTRICAL' AND name = 'Electrical Department';
UPDATE departments SET name = 'Traffic Management / Signals', description = 'Traffic signals and traffic control devices' WHERE code = 'TRAFFIC' AND name = 'Traffic Department';
UPDATE departments SET name = 'Gardens & Tree Management', description = 'Tree hazards, fallen trees, trimming and overgrown vegetation' WHERE code = 'GARDENS' AND name = 'Gardens & Tree Department';
UPDATE departments SET name = 'Encroachment & Unauthorized Occupation', description = 'Encroachment on roads, footpaths and public land' WHERE code = 'ENCROACHMENT' AND name = 'Encroachment Removal';
UPDATE departments SET name = 'General Civic Services', description = 'Uncategorised and general civic complaints (also the routing fallback)' WHERE code = 'GENERAL_CIVIC' AND name = 'General Administration';
