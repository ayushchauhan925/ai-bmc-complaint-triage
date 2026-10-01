const bcrypt = require('bcryptjs');
const { pool } = require('../../config/db');
const userModel = require('../../models/user.model');
const departmentModel = require('../../models/department.model');
const wardModel = require('../../models/ward.model');
const auditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { ROLES } = require('../../utils/constants');

async function assertActiveDepartment(id) {
  const dept = await departmentModel.findById(id);
  if (!dept) throw new AppError('Department not found.', 404);
  if (!dept.is_active) throw new AppError('That department is inactive; choose an active department.', 409);
  return dept;
}

async function assertWard(id) {
  if (id === null || id === undefined) return null;
  const ward = await wardModel.findById(id);
  if (!ward) throw new AppError('Ward not found.', 404);
  return ward;
}

async function openAssignmentCount(officerId) {
  const [[row]] = await pool.query("SELECT COUNT(*) AS cnt FROM complaints WHERE officer_id = ? AND status NOT IN ('RESOLVED', 'REJECTED')", [officerId]);
  return Number(row.cnt);
}

async function releaseAssignments(officerId) {
  const [res] = await pool.query("UPDATE complaints SET officer_id = NULL WHERE officer_id = ? AND status NOT IN ('RESOLVED', 'REJECTED')", [officerId]);
  return res.affectedRows;
}

/** Officers are created by admins only, with a department and (optionally) a ward from the database lists. */
async function createOfficer({ name, email, password, phone, departmentId, wardId }, actor) {
  await assertActiveDepartment(departmentId);
  await assertWard(wardId);
  if (await userModel.findByEmail(email)) throw new AppError('An account with this email already exists.', 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userModel.create({ name, email, passwordHash, phone, role: ROLES.OFFICER, departmentId, wardId: wardId ?? null });
  await auditService.record({ actor, action: 'OFFICER_CREATED', entityType: 'user', entityId: user.id, next: { departmentId, wardId: wardId ?? null, email } });
  return user;
}

async function updateOfficer(id, changes, actor) {
  const officer = await userModel.findById(id);
  if (!officer || officer.role !== ROLES.OFFICER) throw new AppError('Officer not found.', 404);

  const next = {};
  if (changes.name !== undefined) next.name = changes.name;
  if (changes.phone !== undefined) next.phone = changes.phone;

  if (changes.ward_id !== undefined) {
    await assertWard(changes.ward_id);
    next.ward_id = changes.ward_id;
  }

  let releaseNeeded = false;
  if (changes.department_id !== undefined && changes.department_id !== officer.department_id) {
    await assertActiveDepartment(changes.department_id);
    next.department_id = changes.department_id;
    releaseNeeded = true; // their open complaints belong to the old department's queue
  }
  if (changes.is_active === false && officer.is_active) releaseNeeded = true;
  if (changes.is_active !== undefined) next.is_active = changes.is_active ? 1 : 0;

  let released = 0;
  if (releaseNeeded) {
    const open = await openAssignmentCount(officer.id);
    if (open > 0) {
      if (!changes.release_assignments) {
        throw new AppError(`This officer has ${open} open assignment(s). Release them back to the queue to continue.`, 409, { openAssignments: open });
      }
      released = await releaseAssignments(officer.id);
    }
  }

  const keys = Object.keys(next);
  if (keys.length > 0) {
    await pool.query(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => next[k]), officer.id]);
  }

  await auditService.record({
    actor,
    action: changes.is_active === false ? 'OFFICER_DEACTIVATED' : changes.is_active === true && !officer.is_active ? 'OFFICER_ACTIVATED' : 'OFFICER_UPDATED',
    entityType: 'user',
    entityId: officer.id,
    previous: { departmentId: officer.department_id, wardId: officer.ward_id, isActive: Boolean(officer.is_active) },
    next: { ...next, releasedAssignments: released },
  });
  return { officer: await userModel.findById(officer.id), released };
}

module.exports = { createOfficer, updateOfficer };
