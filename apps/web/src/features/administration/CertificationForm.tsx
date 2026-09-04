import { useState, type FormEvent } from 'react';

import { adminMutation, type AdminResource } from './api';

interface Requirement {
  title: string;
  type: 'skill' | 'trail';
  targetId: string;
  required: boolean;
}

export function CertificationForm() {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [description, setDescription] = useState('');
  const [skillIds, setSkillIds] = useState('');
  const [trailIds, setTrailIds] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [resource, setResource] = useState<AdminResource | null>(null);
  const [error, setError] = useState('');

  function addRequirement() {
    setRequirements((current) => [
      ...current,
      { title: '', type: 'skill', targetId: '', required: true },
    ]);
  }

  function updateRequirement(index: number, patch: Partial<Requirement>) {
    setRequirements((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      const result = await adminMutation<AdminResource>(
        resource ? `/v1/admin/catalog/certification/${resource.id}` : '/v1/admin/certifications',
        resource ? 'PATCH' : 'POST',
        {
          slug,
          name,
          issuer,
          description,
          skillIds: skillIds.split(/[\s,]+/).filter(Boolean),
          trailIds: trailIds.split(/[\s,]+/).filter(Boolean),
          requirements: requirements.map((item, index) => ({ ...item, position: index + 1 })),
        },
      );
      setResource(result);
    } catch {
      setError('Nao foi possivel salvar a certificacao e seus requisitos.');
    }
  }

  async function publish() {
    if (!resource) return;
    try {
      await adminMutation(
        `/v1/admin/catalog/certification/${resource.id}/publications`,
        'POST',
        undefined,
        true,
      );
      setResource({ ...resource, status: 'published' });
      setError('');
    } catch {
      setError('Nao foi possivel publicar a certificacao e seus requisitos.');
    }
  }

  async function lifecycle(status: 'unpublished' | 'inactive') {
    if (!resource) return;
    try {
      const result = await adminMutation<AdminResource>(
        `/v1/admin/catalog/certification/${resource.id}/status`,
        'PATCH',
        { status },
      );
      setResource(result);
    } catch {
      setError('Certificacoes referenciadas devem ser desativadas.');
    }
  }

  return (
    <form onSubmit={(event) => void save(event)}>
      <h3>Nova certificacao</h3>
      <p className="lifecycle-state">
        {resource?.status === 'published' ? 'Publicada' : resource ? 'Rascunho salvo' : 'Rascunho'}
      </p>
      <label htmlFor="certification-slug-admin">Slug da certificacao</label>
      <input
        id="certification-slug-admin"
        required
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        value={slug}
        onChange={(event) => setSlug(event.target.value)}
      />
      <label htmlFor="certification-name-admin">Nome da certificacao</label>
      <input
        id="certification-name-admin"
        required
        maxLength={180}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <label htmlFor="certification-issuer-admin">Emissor</label>
      <input
        id="certification-issuer-admin"
        required
        maxLength={180}
        value={issuer}
        onChange={(event) => setIssuer(event.target.value)}
      />
      <label htmlFor="certification-description-admin">Descricao da certificacao</label>
      <textarea
        id="certification-description-admin"
        required
        maxLength={8000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <label htmlFor="certification-skills-admin">IDs de habilidades relacionadas</label>
      <input
        id="certification-skills-admin"
        value={skillIds}
        onChange={(event) => setSkillIds(event.target.value)}
      />
      <label htmlFor="certification-trails-admin">IDs de trilhas relacionadas</label>
      <input
        id="certification-trails-admin"
        value={trailIds}
        onChange={(event) => setTrailIds(event.target.value)}
      />
      <div className="step-toolbar">
        <h4>Requisitos ordenados</h4>
        <button className="secondary-button" type="button" onClick={addRequirement}>
          Adicionar requisito
        </button>
      </div>
      {requirements.map((requirement, index) => (
        <fieldset key={index}>
          <legend>Requisito {index + 1}</legend>
          <label htmlFor={`requirement-title-${index}`}>Titulo do requisito {index + 1}</label>
          <input
            id={`requirement-title-${index}`}
            required
            maxLength={180}
            value={requirement.title}
            onChange={(event) => updateRequirement(index, { title: event.target.value })}
          />
          <label htmlFor={`requirement-type-${index}`}>Tipo do requisito {index + 1}</label>
          <select
            id={`requirement-type-${index}`}
            value={requirement.type}
            onChange={(event) =>
              updateRequirement(index, { type: event.target.value as 'skill' | 'trail' })
            }
          >
            <option value="skill">Habilidade</option>
            <option value="trail">Trilha</option>
          </select>
          <label htmlFor={`requirement-target-${index}`}>Alvo do requisito {index + 1}</label>
          <input
            id={`requirement-target-${index}`}
            required
            pattern="[0-9a-fA-F-]{36}"
            value={requirement.targetId}
            onChange={(event) => updateRequirement(index, { targetId: event.target.value })}
          />
        </fieldset>
      ))}
      {error && <p role="alert">{error}</p>}
      <div className="admin-actions">
        <button type="submit">Salvar certificacao</button>
        <button type="button" disabled={!resource} onClick={() => void publish()}>
          Publicar certificacao
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!resource}
          onClick={() => void lifecycle('unpublished')}
        >
          Despublicar certificacao
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={!resource}
          onClick={() => void lifecycle('inactive')}
        >
          Desativar certificacao
        </button>
      </div>
    </form>
  );
}
