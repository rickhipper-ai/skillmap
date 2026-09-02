export interface AnonymousMetricValue {
  contributorCount: number;
  value: number;
}

export function visibleAnonymousMetric<T extends AnonymousMetricValue>(metric: T): T | null {
  return metric.contributorCount >= 5 ? metric : null;
}

export function aggregateAnonymousMetric(values: readonly number[]): AnonymousMetricValue | null {
  if (values.length < 5) return null;
  return {
    contributorCount: values.length,
    value: values.reduce((total, value) => total + value, 0),
  };
}
