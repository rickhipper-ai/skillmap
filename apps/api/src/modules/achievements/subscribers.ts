import type { CertificationRecordedSubscriber } from '../credentials/service.js';
import type { ProgressEventSubscriber } from '../progress/service.js';
import type { AchievementService } from './service.js';

export function createAchievementSubscribers(service: AchievementService): {
  onProgressEvent: ProgressEventSubscriber;
  onCertificationRecorded: CertificationRecordedSubscriber;
} {
  return {
    onProgressEvent: (event, executor) =>
      service.evaluate(
        {
          userId: event.userId,
          trigger: { type: 'progress_event', eventId: event.eventId },
        },
        executor,
      ),
    onCertificationRecorded: (event, executor) =>
      service.evaluate(
        {
          userId: event.userId,
          trigger: { type: 'certification_record', recordId: event.recordId },
        },
        executor,
      ),
  };
}
