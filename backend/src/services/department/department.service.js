const { pool } = require('../../config/db');
const departmentModel = require('../../models/department.model');
const auditService = require('../audit/audit.service');
const timeline = require('../complaint/timeline.service');
const AppError = require('../../utils/AppError');
const {
  FALLBACK_DEPARTMENT_CODE,
  DEPARTMENT_CATALOG,
  categoriesForDepartment,
  secondaryCategoriesForDepartment,
} = require('../../utils/departmentCatalog');

const catalogByCode = new Map(DEPARTMENT_CATALOG.map((d) => [d.code, d]));

/** Department rows enriched with the categories they handle (from the catalog) and live counts. */
async function overview({ search, active } = {}) {
  const rows = await departmentModel.listWithCounts({ search, active });
  return rows.map((d) => {
    const cat = catalogByCode.get(d.code);
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      description: d.description,
      isActive: Boolean(d.is_active),
      contactEmail: d.contact_email,
      contactPhone: d.contact_phone,
      isFallback: d.code === FALLBACK_DEPARTMENT_CODE,
      inCatalog: Boolean(cat),
      primaryCategories: categoriesForDepartment(d.code),
      secondaryCategories: secondaryCategoriesForDepartment(d.code),
      activeOfficers: Number(d.active_officers),
      totalOfficers: Number(d.total_officers),
      activeComplaints: Number(d.active_complaints),
      criticalComplaints: Number(d.critical_complaints),
      updatedAt: d.updated_at,
    };
  });
}

/**
 * Activate / deactivate a department safely.
 *  - The General Civic Services fallback can never be deactivated (routing needs a last resort).
 *  - A department with open complaints can only be deactivated together with a reassignment:
 *    its open complaints and incidents move to another ACTIVE department (officer assignments
 *    are cleared, since officers belong to the old department) and each move is recorded on the
 *    complaint timeline and in the audit log. Closed complaints keep their original department.
 */
async function setActive(departmentId, active, { reassignToId = null, actor }) {
  const dept = await departmentModel.findById(departmentId);
  if (!dept) throw new AppError('Department not found.', 404);
  if (Boolean(dept.is_active) === active) return { department: dept, reassigned: 0 };

  if (active) {
    await departmentModel.update(dept.id, { is_active: 1 });
    await auditService.record({ actor, action: 'DEPARTMENT_ACTIVATED', entityType: 'department', entityId: dept.id, previous: { isActive: false }, next: { isActive: true } });
    return { department: await departmentModel.findById(dept.id), reassigned: 0 };
  }

  if (dept.code === FALLBACK_DEPARTMENT_CODE) {
    throw new AppError('The General Civic Services department is the routing fallback and cannot be deactivated.', 409);
  }

  const open = await departmentModel.countOpenComplaints(dept.id);
  let reassigned = 0;
  if (open > 0) {
    if (!reassignToId) {
      throw new AppError(`${open} open complaint(s) are still assigned to this department. Choose a department to reassign them to before deactivating.`, 409, { openComplaints: open });
    }
    if (Number(reassignToId) === dept.id) throw new AppError('Choose a different department to reassign to.', 400);
    const target = await departmentModel.findById(reassignToId);
    if (!target) throw new AppError('Reassignment department not found.', 404);
    if (!target.is_active) throw new AppError('The reassignment department is inactive.', 409);

    const conn = await pool.getConnection();
    let movedIds;
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query("SELECT id FROM complaints WHERE department_id = ? AND status NOT IN ('RESOLVED', 'REJECTED')", [dept.id]);
      movedIds = rows.map((r) => r.id);
      await conn.query("UPDATE complaints SET department_id = ?, officer_id = NULL WHERE department_id = ? AND status NOT IN ('RESOLVED', 'REJECTED')", [target.id, dept.id]);
      await conn.query("UPDATE incidents SET department_id = ? WHERE department_id = ? AND status IN ('OPEN', 'IN_PROGRESS')", [target.id, dept.id]);
      await conn.query('UPDATE departments SET is_active = FALSE WHERE id = ?', [dept.id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    reassigned = movedIds.length;
    for (const cid of movedIds) {
      await timeline.recordEvent(cid, timeline.EVENT_TYPES.DEPARTMENT_ASSIGNED, `Moved to ${target.name} (previous department deactivated)`, {
        details: { fromDepartmentId: dept.id, toDepartmentId: target.id },
        actorId: actor?.id ?? null,
      });
    }
  } else {
    await departmentModel.update(dept.id, { is_active: 0 });
  }

  await auditService.record({
    actor,
    action: 'DEPARTMENT_DEACTIVATED',
    entityType: 'department',
    entityId: dept.id,
    previous: { isActive: true },
    next: { isActive: false, reassignedComplaints: reassigned, reassignedTo: reassignToId || null },
  });
  return { department: await departmentModel.findById(dept.id), reassigned };
}

module.exports = { overview, setActive };
