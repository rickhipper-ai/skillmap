import type { LoaderFunctionArgs } from 'react-router-dom';

export interface CatalogRouteData {
  q: string;
  type: string;
  categoryId: string;
}

export function catalogRouteLoader({ request }: LoaderFunctionArgs): CatalogRouteData {
  const search = new URL(request.url).searchParams;
  return {
    q: search.get('q') ?? '',
    type: search.get('type') ?? '',
    categoryId: search.get('categoryId') ?? '',
  };
}

export function detailRouteLoader({ params }: LoaderFunctionArgs): { id: string } {
  const id = params.skillId ?? params.trailId ?? params.certificationId;
  if (!id) throw new Response('Item nao encontrado', { status: 404 });
  return { id };
}
