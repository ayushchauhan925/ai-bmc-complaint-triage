const departmentModel = require('../../models/department.model');
const { CATEGORY_TO_DEPARTMENT, DEPARTMENT_CODES } = require('../../utils/constants');

// Deterministic category -> department routing (Section 10). AI never decides this;
// department names are stored in MySQL, only the routing *key* lives in code.
async function routeToDepartment(category) {
  const code = CATEGORY_TO_DEPARTMENT[category] || DEPARTMENT_CODES.GENERAL;
  const department = await departmentModel.findByCode(code);
  return department;
}

module.exports = { routeToDepartment };
