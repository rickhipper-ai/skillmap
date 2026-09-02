import { Link } from 'react-router-dom';

import type { CatalogItem } from '../catalog/api';

interface RelationshipTableProps {
  trails: CatalogItem[];
  certifications: CatalogItem[];
}

export function RelationshipTable({ trails, certifications }: RelationshipTableProps) {
  const relationships = [
    ...trails.map((item) => ({ ...item, label: 'Trilha', path: 'trilhas' })),
    ...certifications.map((item) => ({ ...item, label: 'Certificacao', path: 'certificacoes' })),
  ];
  return (
    <div className="table-scroll">
      <table aria-label="Relacionamentos da habilidade">
        <thead>
          <tr>
            <th scope="col">Tipo</th>
            <th scope="col">Item relacionado</th>
            <th scope="col">Resumo</th>
          </tr>
        </thead>
        <tbody>
          {relationships.map((item) => (
            <tr key={`${item.type}:${item.id}`}>
              <td>{item.label}</td>
              <th scope="row">
                <Link to={`/${item.path}/${item.id}`}>{item.title}</Link>
              </th>
              <td>{item.summary}</td>
            </tr>
          ))}
          {relationships.length === 0 && (
            <tr>
              <td colSpan={3}>Nenhum relacionamento publicado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
