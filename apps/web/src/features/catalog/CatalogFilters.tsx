import type { CatalogFilters as Filters, Category, CatalogItemType } from './api';

interface CatalogFiltersProps {
  categories: Category[];
  filters: Filters;
  onChange(filters: Filters): void;
  onClear(): void;
}

export function CatalogFilters({ categories, filters, onChange, onClear }: CatalogFiltersProps) {
  return (
    <form className="catalog-filters" role="search" onSubmit={(event) => event.preventDefault()}>
      <label htmlFor="catalog-query">Buscar no catalogo</label>
      <input
        id="catalog-query"
        type="search"
        value={filters.q}
        onChange={(event) => onChange({ ...filters, q: event.target.value })}
      />
      <label htmlFor="catalog-type">Tipo de item</label>
      <select
        id="catalog-type"
        value={filters.type}
        onChange={(event) =>
          onChange({ ...filters, type: event.target.value as '' | CatalogItemType })
        }
      >
        <option value="">Todos os tipos</option>
        <option value="skill">Habilidades</option>
        <option value="trail">Trilhas</option>
        <option value="certification">Certificacoes</option>
      </select>
      <label htmlFor="catalog-category">Categoria</label>
      <select
        id="catalog-category"
        value={filters.categoryId}
        onChange={(event) => onChange({ ...filters, categoryId: event.target.value })}
      >
        <option value="">Todas as categorias</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <button className="secondary-button" type="button" onClick={onClear}>
        Limpar filtros
      </button>
    </form>
  );
}
