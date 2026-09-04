import { useState, type FormEvent } from 'react';

import { adminMutation, type AdminResource } from './api';

export function SkillForm() {
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [resource, setResource] = useState<AdminResource | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    try {
      const result = await adminMutation<AdminResource>(
        resource ? `/v1/admin/catalog/skill/${resource.id}` : '/v1/admin/skills',
        resource ? 'PATCH' : 'POST',
        {
          slug,
          categoryId,
          name,
          description,
        },
      );
      setResource(result);
    } catch {
      setMessage('Nao foi possivel salvar a habilidade. Revise os campos e relacionamentos.');
    } finally {
      setPending(false);
    }
  }

  async function publish() {
    if (!resource) return;
    setPending(true);
    try {
      await adminMutation(
        `/v1/admin/catalog/skill/${resource.id}/publications`,
        'POST',
        undefined,
        true,
      );
      setResource({ ...resource, status: 'published' });
    } catch {
      setMessage('Nao foi possivel publicar a habilidade.');
    } finally {
      setPending(false);
    }
  }

  async function lifecycle(status: 'unpublished' | 'inactive') {
    if (!resource) return;
    setPending(true);
    try {
      const result = await adminMutation<AdminResource>(
        `/v1/admin/catalog/skill/${resource.id}/status`,
        'PATCH',
        { status },
      );
      setResource(result);
      setMessage('');
    } catch {
      setMessage('Itens referenciados devem ser desativados em vez de despublicados.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)}>
      <h3>Nova habilidade</h3>
      <p className="lifecycle-state">
        {resource?.status === 'published' ? 'Publicada' : 'Rascunho'}
      </p>
      <label htmlFor="skill-slug">Slug da habilidade</label>
      <input
        id="skill-slug"
        required
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        maxLength={100}
        value={slug}
        onChange={(event) => setSlug(event.target.value)}
      />
      <label htmlFor="skill-category">Categoria da habilidade</label>
      <input
        id="skill-category"
        required
        pattern="[0-9a-fA-F-]{36}"
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
      />
      <label htmlFor="skill-name">Nome da habilidade</label>
      <input
        id="skill-name"
        required
        maxLength={160}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <label htmlFor="skill-description">Descricao da habilidade</label>
      <textarea
        id="skill-description"
        required
        maxLength={4000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      {message && <p role="alert">{message}</p>}
      <div className="admin-actions">
        <button type="submit" disabled={pending}>
          Salvar habilidade
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!resource || pending}
          onClick={() => void publish()}
        >
          Publicar habilidade
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!resource || pending}
          onClick={() => void lifecycle('unpublished')}
        >
          Despublicar habilidade
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={!resource || pending}
          onClick={() => void lifecycle('inactive')}
        >
          Desativar habilidade
        </button>
      </div>
    </form>
  );
}
