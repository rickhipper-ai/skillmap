import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

export type WebVitalReporter = (metric: Metric) => void;

export function observeWebVitals(report: WebVitalReporter): void {
  onCLS(report);
  onINP(report);
  onLCP(report);
}
