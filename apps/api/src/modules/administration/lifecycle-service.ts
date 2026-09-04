import { HttpProblem } from '../../plugins/problem-details.js';
import { AdministrationRepository, type AdminResource } from './repository.js';
import type { ResourceType } from './schemas.js';

export class LifecycleService {
  constructor(private readonly repository: AdministrationRepository) {}

  updateStatus(
    type: ResourceType,
    id: string,
    status: 'unpublished' | 'inactive',
  ): Promise<AdminResource> {
    return this.repository.transaction(async (repository) => {
      const resource = await repository.getResource(type, id, true);
      if (!resource) {
        throw new HttpProblem({
          status: 404,
          title: 'Not Found',
          code: 'CATALOG_RESOURCE_NOT_FOUND',
        });
      }
      if (status === 'unpublished' && (await repository.isReferenced(type, id))) {
        throw new HttpProblem({
          status: 409,
          title: 'Conflict',
          code: 'REFERENCED_RESOURCE_REQUIRES_DEACTIVATION',
          extensions: { allowedStatus: 'inactive' },
        });
      }
      const updated = await repository.setLifecycle(type, id, status);
      await repository.markUsersAffectedBy(type, id);
      return updated;
    });
  }
}
