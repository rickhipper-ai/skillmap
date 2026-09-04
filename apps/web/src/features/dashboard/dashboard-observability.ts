export interface DashboardReadyDetail {
  eventName: 'dashboard_view_ready';
  activeTrailCount: number;
  recommendationCount: number;
}

export function reportDashboardViewReady(counts: Omit<DashboardReadyDetail, 'eventName'>): void {
  const detail: DashboardReadyDetail = { eventName: 'dashboard_view_ready', ...counts };
  performance.mark?.('dashboard_view_ready');
  window.dispatchEvent(new CustomEvent('skillmaps:dashboard-view-ready', { detail }));
  window.dispatchEvent(new CustomEvent('skillmaps:analytics', { detail }));
}
