import { Department } from '../models/index.js';

function idOf(value: any): string | null {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

/**
 * Every department a user is responsible for.
 *
 * A department head is linked to their department in two independent places:
 * `User.department` and `Department.head`. Either one may be missing, so both
 * are consulted — relying on `User.department` alone hides a whole
 * department's requisitions from its head.
 */
export async function resolveUserDepartmentIds(user: any): Promise<string[]> {
  const ids = new Set<string>();

  const own = idOf(user?.department);
  if (own) ids.add(own);

  const headed = await Department.find({ head: user?._id, isDeleted: false })
    .select('_id')
    .lean();
  for (const dept of headed) {
    const id = idOf(dept._id);
    if (id) ids.add(id);
  }

  return Array.from(ids);
}

/**
 * Whether the user may act on a record belonging to `departmentId`.
 * Admins are unrestricted.
 */
export async function canActOnDepartment(
  user: any,
  departmentId: any
): Promise<boolean> {
  if (user?.role === 'admin') return true;
  const target = idOf(departmentId);
  if (!target) return false;
  const ids = await resolveUserDepartmentIds(user);
  return ids.includes(target);
}

/**
 * Mongo filter fragment restricting a query to the user's departments.
 * Returns a filter that matches nothing when the user has no department at
 * all, so an unassigned user never sees the whole organisation's records.
 */
export async function buildDepartmentFilter(
  user: any
): Promise<Record<string, unknown>> {
  const ids = await resolveUserDepartmentIds(user);
  if (ids.length === 0) return { department: null };
  if (ids.length === 1) return { department: ids[0] };
  return { department: { $in: ids } };
}
