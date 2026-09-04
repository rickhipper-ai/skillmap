import { useState, type FormEvent } from 'react';

import { adminMutation, type AdminResource } from './api';

export function AchievementForm() {
  const [minimum, setMinimum] = useState(1);
  const [error, setError] = useState('');
  const [resource, setResource] = useState<AdminResource | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (minimum < 1 || minimum > 1000) {
      setError('A quantidade minima deve estar entre 1 e 1000.');
      return;
    }
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      const result = await adminMutation<AdminResource>(
        resource ? `/v1/admin/catalog/achievement/${resource.id}` : '/v1/admin/achievements',
        resource ? 'PATCH' : 'POST',
        {
          slug: String(form.get('slug')),
          title: String(form.get('title')),
          description: String(form.get('description')),
          iconLabel: String(form.get('iconLabel')),
          criterionType: String(form.get('criterionType')),
          criterionParameters: { minimum },
        },
      );
      setResource(result);
    } catch {
      setError('Nao foi possivel salvar a conquista.');
    }
  }

  async function publish() {
    if (!resource) return;
    try {
      await adminMutation(
        `/v1/admin/catalog/achievement/${resource.id}/publications`,
        'POST',
        undefined,
        true,
      );
      setResource({ ...resource, status: 'published' });
      setError('');
    } catch {
      setError('Nao foi possivel publicar a conquista.');
    }
  }

  async function lifecycle(status: 'unpublished' | 'inactive') {
    if (!resource) return;
    try {
      const result = await adminMutation<AdminResource>(
        `/v1/admin/catalog/achievement/${resource.id}/status`,
        'PATCH',
        { status },
      );
      setResource(result);
    } catch {
      setError('Conquistas concedidas devem ser desativadas.');
    }
  }

  return (
    <form onSubmit={(event) => void save(event)}>
      <h3>Nova conquista</h3>
      <p className="lifecycle-state">
        {resource?.status === 'published' ? 'Publicada' : resource ? 'Rascunho salvo' : 'Rascunho'}
      </p>
      <label htmlFor="achievement-slug">Slug da conquista</label>
      <input id="achievement-slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
      <label htmlFor="achievement-title">Titulo da conquista</label>
      <input id="achievement-title" name="title" required maxLength={180} />
      <label htmlFor="achievement-description">Descricao da conquista</label>
      <textarea id="achievement-description" name="description" required maxLength={2000} />
      <label htmlFor="achievement-icon">Rotulo do icone</label>
      <input id="achievement-icon" name="iconLabel" required maxLength={120} />
      <label htmlFor="achievement-criterion">Criterio</label>
      <select id="achievement-criterion" name="criterionType">
        <option value="completed_steps">Etapas concluidas</option>
        <option value="certification_records">Certificacoes registradas</option>
      </select>
      <label htmlFor="achievement-minimum">Quantidade minima</label>
      <input
        id="achievement-minimum"
        type="number"
        min={1}
        max={1000}
        value={minimum}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'achievement-minimum-error' : undefined}
        onChange={(event) => {
          const next = Number(event.target.value);
          setMinimum(next);
          setError(next < 1 || next > 1000 ? 'A quantidade minima deve estar entre 1 e 1000.' : '');
        }}
      />
      {error && (
        <p id="achievement-minimum-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-actions">
        <button type="submit">Salvar conquista</button>
        <button type="button" disabled={!resource} onClick={() => void publish()}>
          Publicar conquista
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!resource}
          onClick={() => void lifecycle('unpublished')}
        >
          Despublicar conquista
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={!resource}
          onClick={() => void lifecycle('inactive')}
        >
          Desativar conquista
        </button>
      </div>
    </form>
  );
}
