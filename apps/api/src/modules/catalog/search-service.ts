import { HttpProblem } from '../../plugins/problem-details.js';
import type { CatalogRepository } from './repository.js';
import type {
  CatalogItemType,
  CatalogPage,
  CatalogSearchCriteria,
  CatalogSearchCursor,
} from './types.js';

export interface CatalogSearchInput {
  q?: string;
  type?: CatalogItemType;
  categoryId?: string;
  cursor?: string;
  limit?: number;
}

export class CatalogSearchService {
  constructor(private readonly repository: CatalogRepository) {}

  listCategories() {
    return this.repository.listCategories();
  }

  async search(input: CatalogSearchInput): Promise<CatalogPage> {
    const limit = input.limit ?? 20;
    const criteria: CatalogSearchCriteria = {
      limit: limit + 1,
      ...(input.q === undefined ? {} : { query: input.q }),
      ...(input.type === undefined ? {} : { type: input.type }),
      ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
      ...(input.cursor === undefined ? {} : { cursor: decodeCursor(input.cursor) }),
    };
    const rows = await this.repository.search(criteria);
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasNextPage && last
          ? encodeCursor({
              title: last.title.toLocaleLowerCase('pt-BR'),
              type: last.type,
              id: last.id,
            })
          : null,
    };
  }
}

function encodeCursor(cursor: CatalogSearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string): CatalogSearchCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('title' in parsed) ||
      typeof parsed.title !== 'string' ||
      !('type' in parsed) ||
      !['skill', 'trail', 'certification'].includes(String(parsed.type)) ||
      !('id' in parsed) ||
      typeof parsed.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id)
    ) {
      throw new Error('invalid cursor');
    }
    return parsed as CatalogSearchCursor;
  } catch {
    throw new HttpProblem({
      status: 422,
      title: 'Validation failed',
      code: 'INVALID_CURSOR',
    });
  }
}
