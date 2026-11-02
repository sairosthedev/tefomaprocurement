import { isProcurementHead } from '@fossil/shared';

type ReportUser = { role?: string; department?: string } | null | undefined;

export function canViewSupplierReports(user: ReportUser): boolean {
  if (!user?.role) return false;
  if (user.role === 'admin' || user.role === 'coo' || user.role === 'procurement_officer') {
    return true;
  }
  return isProcurementHead(user);
}
