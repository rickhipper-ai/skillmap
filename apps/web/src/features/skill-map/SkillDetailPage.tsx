import { useLoaderData } from 'react-router-dom';

import { useSkill } from '../catalog/api';
import { RelationshipTable } from './RelationshipTable';

export function SkillDetailPage() {
  const { id } = useLoaderData() as { id: string };
  const skill = useSkill(id);
  if (skill.isPending) return <p role="status">Carregando habilidade...</p>;
  if (skill.isError) return <p role="alert">Nao foi possivel carregar a habilidade.</p>;
  return (
    <section className="detail-page">
      <p className="eyebrow">Habilidade canonica</p>
      <h1 tabIndex={-1}>{skill.data.title}</h1>
      {skill.data.category && <p className="category-label">{skill.data.category.name}</p>}
      <p className="detail-summary">{skill.data.summary}</p>
      <h2>Onde esta habilidade aparece</h2>
      <RelationshipTable
        trails={skill.data.relatedTrails}
        certifications={skill.data.relatedCertifications}
      />
    </section>
  );
}
