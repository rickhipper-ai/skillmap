import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiBaseUrl, mapProblemDetails } from '../../services/api-client';

export type CatalogItemType = 'skill' | 'trail' | 'certification';

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export interface CatalogItem {
  id: string;
  type: CatalogItemType;
  slug: string;
  title: string;
  summary: string;
  category: Category | null;
}

export interface SkillDetail extends CatalogItem {
  relatedTrails: CatalogItem[];
  relatedCertifications: CatalogItem[];
}

export interface TrailStep {
  id: string;
  position: number;
  title: string;
  description?: string;
  required: boolean;
  skills: CatalogItem[];
  prerequisiteStepIds: string[];
}

export interface TrailDetail extends CatalogItem {
  revisionId: string;
  steps: TrailStep[];
  relatedCertifications: CatalogItem[];
}

export interface CertificationDetail extends CatalogItem {
  revisionId: string;
  issuer: string;
  skills: CatalogItem[];
  trails: CatalogItem[];
  requirements: Array<{
    id: string;
    position?: number;
    title: string;
    type: 'skill' | 'trail';
    targetId: string;
    required: boolean;
  }>;
}

export interface CatalogFilters {
  q: string;
  type: '' | CatalogItemType;
  categoryId: string;
}

interface CatalogPage {
  items: CatalogItem[];
  nextCursor: string | null;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw mapProblemDetails(await response.json().catch(() => undefined));
  return (await response.json()) as T;
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => getJson<Category[]>('/v1/categories'),
    retry: false,
  });
}

export function useCatalog(filters: CatalogFilters) {
  return useInfiniteQuery({
    queryKey: ['catalog', filters],
    initialPageParam: null as string | null,
    retry: false,
    queryFn: ({ pageParam }) => {
      const search = new URLSearchParams();
      if (filters.q) search.set('q', filters.q);
      if (filters.type) search.set('type', filters.type);
      if (filters.categoryId) search.set('categoryId', filters.categoryId);
      if (pageParam) search.set('cursor', pageParam);
      search.set('limit', '20');
      return getJson<CatalogPage>(`/v1/catalog?${search}`);
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useSkill(skillId: string) {
  return useQuery({
    queryKey: ['skill', skillId],
    queryFn: () => getJson<SkillDetail>(`/v1/skills/${skillId}`),
    retry: false,
  });
}

export function useTrail(trailId: string) {
  return useQuery({
    queryKey: ['trail', trailId],
    queryFn: () => getJson<TrailDetail>(`/v1/trails/${trailId}`),
    retry: false,
  });
}

export function useCertification(certificationId: string) {
  return useQuery({
    queryKey: ['certification', certificationId],
    queryFn: () => getJson<CertificationDetail>(`/v1/certifications/${certificationId}`),
    retry: false,
  });
}
