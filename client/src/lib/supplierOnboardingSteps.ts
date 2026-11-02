import type { WorkflowStep } from '../components/WorkflowStepper';

/**
 * A supplier's onboarding, from registration to an active supplier who may be
 * awarded work. `ticked` / `total` are the required KYS checks for its tier.
 */
export function supplierSteps(supplier: any, ticked: number, total: number): WorkflowStep[] {
  const classified = !!supplier.tier && supplier.tier !== 'unclassified';
  const kysDone = !!supplier.kysComplete || !!supplier.kysExempt || supplier.status !== 'pending';
  const stopped = ['suspended', 'blacklisted', 'dormant'].includes(supplier.status);
  const raw = [
    {
      key: 'registered',
      label: 'Registered',
      done: true,
      detail: supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString() : undefined
    },
    {
      key: 'tier',
      label: 'Diligence tier',
      // Unclassified is treated as full depth, so it never blocks activation.
      done: classified || kysDone,
      detail: classified ? supplier.tier : kysDone ? 'Full depth' : undefined
    },
    {
      key: 'kys',
      label: 'KYS verified',
      done: kysDone,
      detail: supplier.kysExempt ? 'Override' : kysDone ? 'Verified' : `${ticked}/${total} checks`
    },
    {
      key: 'active',
      label: 'Active',
      done: supplier.status === 'active',
      detail: stopped ? supplier.status.charAt(0).toUpperCase() + supplier.status.slice(1) : undefined
    }
  ];
  const current = raw.findIndex((s) => !s.done);
  return raw.map((s, i) => ({
    key: s.key,
    label: s.label,
    detail: s.detail,
    state: s.done ? 'done' : i === current ? (stopped ? 'stopped' : 'current') : 'upcoming'
  }));
}
