import { useDeferredValue, useState } from 'react';
import { Link, useLoaderData } from 'react-router-dom';

import { useCatalog, useCategories, type CatalogFilters as Filters } from './api';
import { CatalogFilters } from './CatalogFilters';
import type { CatalogRouteData } from './routes';

const typeLabels = {
  skill: 'Habilidade',
  trail: 'Trilha',
  certification: 'Certificacao',
};

const typePaths = {
  skill: 'habilidades',
  trail: 'trilhas',
  certification: 'certificacoes',
};

export function CatalogPage() {
  const initial = useLoaderData() as CatalogRouteData;
  const [filters, setFilters] = useState<Filters>({
    q: initial.q,
    type: ['skill', 'trail', 'certification'].includes(initial.type)
      ? (initial.type as Filters['type'])
      : '',
    categoryId: initial.categoryId,
  });
  const deferredQuery = useDeferredValue(filters.q.trim());
  const effectiveFilters = { ...filters, q: deferredQuery };
  const categories = useCategories();
  const catalog = useCatalog(effectiveFilters);
  const items = catalog.data?.pages.flatMap((page) => page.items) ?? [];
  const clear = () => setFilters({ q: '', type: '', categoryId: '' });

  return (
    <section className="catalog-page">
      <p className="eyebrow">Mapa publico</p>
      <h1 tabIndex={-1}>Catalogo</h1>
      <p>Encontre habilidades canonicas, trilhas ordenadas e certificacoes relacionadas.</p>

      <CatalogFilters
        categories={categories.data ?? []}
        filters={filters}
        onChange={setFilters}
        onClear={clear}
      />

      {(categories.isPending || catalog.isPending) && <p role="status">Carregando catalogo...</p>}
      {(categories.isError || catalog.isError) && (
        <div role="alert">
          <p>Nao foi possivel carregar o catalogo.</p>
          <button
            type="button"
            onClick={() => void Promise.all([categories.refetch(), catalog.refetch()])}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {!catalog.isPending && !catalog.isError && items.length === 0 && (
        <div className="empty-state">
          <h2>Nenhum item encontrado</h2>
          <p>Altere a busca ou remova os filtros para explorar todo o mapa.</p>
        </div>
      )}
      {items.length > 0 && (
        <>
          <p className="results-count" role="status">
            {items.length} itens exibidos
          </p>
          <ul className="catalog-grid">
            {items.map((item) => (
              <li key={`${item.type}:${item.id}`}>
                <p className="item-type">{typeLabels[item.type]}</p>
                <h2>
                  <Link to={`/${typePaths[item.type]}/${item.id}`}>{item.title}</Link>
                </h2>
                <p>{item.summary}</p>
                {item.category && <p className="category-label">{item.category.name}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
      {catalog.hasNextPage && (
        <button
          type="button"
          disabled={catalog.isFetchingNextPage}
          onClick={() => void catalog.fetchNextPage()}
        >
          {catalog.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </section>
  );
}
