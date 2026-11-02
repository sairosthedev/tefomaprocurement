import http from './http';

export const dashboardAPI: any = {
  getStats: (params?: any) => http.get('/dashboard/stats', { params }),
  /**
   * Counts of work waiting on the signed-in user, keyed by nav href.
   * Drives the sidebar badges.
   */
  getActionCounts: () => http.get('/dashboard/action-counts')
};
