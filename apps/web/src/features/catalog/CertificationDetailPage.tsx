import { Link, useLoaderData } from 'react-router-dom';

import { useCertification } from './api';

export function CertificationDetailPage() {
  const { id } = useLoaderData() as { id: string };
  const certification = useCertification(id);
  if (certification.isPending) return <p role="status">Carregando certificacao...</p>;
  if (certification.isError) return <p role="alert">Nao foi possivel carregar a certificacao.</p>;
  const data = certification.data;
  return (
    <section className="detail-page">
      <p className="eyebrow">Certificacao</p>
      <h1 tabIndex={-1}>{data.title}</h1>
      <p className="issuer">
        Emitida por <strong>{data.issuer}</strong>
      </p>
      <p className="detail-summary">{data.summary}</p>
      <h2>Requisitos</h2>
      {data.requirements.length ? (
        <ol className="requirements">
          {data.requirements.map((requirement) => (
            <li key={requirement.id}>
              <strong>{requirement.title}</strong>
              <span>
                {requirement.required ? 'Obrigatorio' : 'Opcional'} ·{' '}
                {requirement.type === 'skill' ? 'Habilidade' : 'Trilha'}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p>Nenhum requisito publicado.</p>
      )}
      <h2>Habilidades</h2>
      <ItemLinks items={data.skills} path="habilidades" />
      <h2>Trilhas relacionadas</h2>
      <ItemLinks items={data.trails} path="trilhas" />
    </section>
  );
}

function ItemLinks({ items, path }: { items: Array<{ id: string; title: string }>; path: string }) {
  return items.length ? (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <Link to={`/${path}/${item.id}`}>{item.title}</Link>
        </li>
      ))}
    </ul>
  ) : (
    <p>Nenhum item publicado.</p>
  );
}
