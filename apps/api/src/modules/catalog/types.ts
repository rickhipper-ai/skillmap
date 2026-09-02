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

export interface CatalogPage {
  items: CatalogItem[];
  nextCursor: string | null;
}

export interface SkillDetail extends CatalogItem {
  type: 'skill';
  relatedTrails: CatalogItem[];
  relatedCertifications: CatalogItem[];
}

export interface TrailStep {
  id: string;
  position: number;
  title: string;
  description: string;
  required: boolean;
  skills: CatalogItem[];
  prerequisiteStepIds: string[];
}

export interface TrailDetail extends CatalogItem {
  type: 'trail';
  revisionId: string;
  steps: TrailStep[];
  relatedCertifications: CatalogItem[];
}

export interface CertificationRequirement {
  id: string;
  position: number;
  title: string;
  type: 'skill' | 'trail';
  targetId: string;
  required: boolean;
}

export interface CertificationDetail extends CatalogItem {
  type: 'certification';
  revisionId: string;
  issuer: string;
  skills: CatalogItem[];
  trails: CatalogItem[];
  requirements: CertificationRequirement[];
}

export interface CatalogSearchCursor {
  title: string;
  type: CatalogItemType;
  id: string;
}

export interface CatalogSearchCriteria {
  query?: string;
  type?: CatalogItemType;
  categoryId?: string;
  cursor?: CatalogSearchCursor;
  limit: number;
}
