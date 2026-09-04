import { useState, type FormEvent } from 'react';

import { ApiProblem } from '../../services/api-client';
import { adminMutation, type AdminResource } from './api';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function CategoryForm() {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [resource, setResource] = useState<AdminResource | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slugPattern.test(slug)) {
      setError('Use letras minusculas, numeros e hifens no slug.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const result = await adminMutation<AdminResource>(
        resource ? `/v1/admin/catalog/category/${resource.id}` : '/v1/admin/categories',
        resource ? 'PATCH' : 'POST',
        {
          slug,
          name,
          description,
        },
      );
      setResource(result);
    } catch (cause) {
      setError(
        cause instanceof ApiProblem && cause.problem.status === 403
          ? 'Voce nao tem permissao para administrar o catalogo.'
          : 'Nao foi possivel salvar a categoria. Revise os campos e tente novamente.',
      );
    } finally {
      setPending(false);
    }
  }

  async function publish() {
    if (!resource) return;
    setPending(true);
    try {
      await adminMutation(
        `/v1/admin/catalog/category/${resource.id}/publications`,
        'POST',
        undefined,
        true,
      );
      setResource({ ...resource, status: 'published' });
      setError('');
    } catch {
      setError('Nao foi possivel publicar a categoria.');
    } finally {
      setPending(false);
    }
  }

  async function lifecycle(status: 'unpublished' | 'inactive') {
    if (!resource) return;
    setPending(true);
    try {
      const result = await adminMutation<AdminResource>(
        `/v1/admin/catalog/category/${resource.id}/status`,
        'PATCH',
        { status },
      );
      setResource(result);
      setError('');
    } catch {
      setError('Itens referenciados devem ser desativados em vez de despublicados.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)}>
      <h3>Nova categoria</h3>
      <p className="lifecycle-state">
        {resource?.status === 'published' ? 'Publicada' : 'Rascunho'}
      </p>
      <label htmlFor="category-slug">Slug da categoria</label>
      <input
        id="category-slug"
        required
        maxLength={100}
        value={slug}
        onChange={(event) => {
          const next = event.target.value;
          setSlug(next);
          setError(
            next && !slugPattern.test(next)
              ? 'Use letras minusculas, numeros e hifens no slug.'
              : '',
          );
        }}
        aria-invalid={error && !slugPattern.test(slug) ? true : undefined}
        aria-describedby={error && !slugPattern.test(slug) ? 'category-slug-error' : undefined}
      />
      <label htmlFor="category-name">Nome da categoria</label>
      <input
        id="category-name"
        required
        maxLength={160}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <label htmlFor="category-description">Descricao da categoria</label>
      <textarea
        id="category-description"
        required
        maxLength={2000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      {error && (
        <p id="category-slug-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-actions">
        <button type="submit" disabled={pending}>
          Salvar categoria
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!resource || pending}
          onClick={() => void publish()}
        >
          Publicar categoria
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!resource || pending}
          onClick={() => void lifecycle('unpublished')}
        >
          Despublicar categoria
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={!resource || pending}
          onClick={() => void lifecycle('inactive')}
        >
          Desativar categoria
        </button>
      </div>
    </form>
  );
}
