const departmentModel = require('../../models/department.model');
const { primaryDepartmentCode, secondaryDepartmentCodes, FALLBACK_DEPARTMENT_CODE } = require('../../utils/departmentCatalog');

const isActive = (dept) => dept && Number(dept.is_active ?? 1) !== 0;

/**
 * Deterministic category -> department routing (the AI never decides this). Routing config lives
 * in utils/departmentCatalog.js; the department *rows* (names, active flag) live in MySQL.
 *
 * Order of preference: the category's primary department; then its secondary departments in
 * catalog order; finally the General Civic Services fallback. An inactive department is skipped,
 * so deactivating one can never leave a complaint without a destination.
 */
async function routeToDepartment(category) {
  const { primary, secondary } = await routeWithSecondary(category);
  return primary || secondary[0] || null;
}

/** Primary department plus any informational secondary departments (all active rows). */
async function routeWithSecondary(category) {
  const primaryCode = primaryDepartmentCode(category);
  const secondaryCodes = secondaryDepartmentCodes(category);

  const candidate = await departmentModel.findByCode(primaryCode);
  let primary = isActive(candidate) ? candidate : null;
  let usedFallback = false;

  const secondary = [];
  for (const code of secondaryCodes) {
    const d = await departmentModel.findByCode(code);
    if (isActive(d)) secondary.push(d);
  }

  if (!primary) {
    // Primary inactive/missing: promote the first active secondary, else the fallback department.
    if (secondary.length > 0) {
      primary = secondary.shift();
    } else if (primaryCode !== FALLBACK_DEPARTMENT_CODE) {
      const fb = await departmentModel.findByCode(FALLBACK_DEPARTMENT_CODE);
      primary = isActive(fb) ? fb : null;
    }
    usedFallback = true;
  }
  return { primary, secondary, usedFallback };
}

module.exports = { routeToDepartment, routeWithSecondary };
