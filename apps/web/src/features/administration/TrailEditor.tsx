import { useState, type FormEvent } from 'react';

import { ApiProblem } from '../../services/api-client';
import { adminMutation, type AdminResource } from './api';

interface EditorStep {
  id: string;
  title: string;
  description: string;
  required: boolean;
  skillIds: string;
  prerequisiteIds: string[];
}

export function TrailEditor() {
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<EditorStep[]>([]);
  const [resource, setResource] = useState<AdminResource | null>(null);
  const [status, setStatus] = useState('Rascunho');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  function addStep() {
    setSteps((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        required: true,
        skillIds: '',
        prerequisiteIds: [],
      },
    ]);
  }

  function updateStep(index: number, patch: Partial<EditorStep>) {
    setSteps((current) =>
      current.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)),
    );
  }

  function moveStep(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= steps.length) return;
    setSteps((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination]!, next[index]!];
      return next;
    });
  }

  function payload() {
    return {
      slug,
      categoryId,
      title,
      description,
      targetRoleIds: [],
      steps: steps.map((step, index) => ({
        stepId: step.id,
        position: index + 1,
        title: step.title,
        description: step.description,
        required: step.required,
        skillIds: step.skillIds.split(/[\s,]+/).filter(Boolean),
        prerequisiteStepIds: step.prerequisiteIds,
      })),
    };
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (steps.length === 0) {
      setError('Adicione ao menos uma etapa valida antes de salvar.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const result = await adminMutation<AdminResource>(
        resource ? `/v1/admin/trails/${resource.id}` : '/v1/admin/trails',
        resource ? 'PATCH' : 'POST',
        payload(),
      );
      setResource(result);
      setStatus('Rascunho salvo');
    } catch (cause) {
      setError(
        cause instanceof ApiProblem && cause.problem.status === 403
          ? 'Voce nao tem permissao para administrar o catalogo.'
          : 'Nao foi possivel salvar. Corrija etapas, posicoes e pre-requisitos.',
      );
    } finally {
      setPending(false);
    }
  }

  async function publish() {
    if (!resource) return;
    setPending(true);
    setError('');
    try {
      await adminMutation(`/v1/admin/trails/${resource.id}/publications`, 'POST', undefined, true);
      setStatus('Publicada');
    } catch {
      setError('A publicacao falhou sem alterar o catalogo. Corrija o grafo e tente novamente.');
    } finally {
      setPending(false);
    }
  }

  async function lifecycle(next: 'unpublished' | 'inactive') {
    if (!resource) return;
    setPending(true);
    try {
      await adminMutation(`/v1/admin/catalog/trail/${resource.id}/status`, 'PATCH', {
        status: next,
      });
      setStatus(next === 'inactive' ? 'Inativa' : 'Despublicada');
    } catch {
      setError('Nao foi possivel alterar o estado. Itens referenciados devem ser desativados.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="trail-editor" onSubmit={(event) => void save(event)}>
      <div className="editor-heading">
        <h3>Editor de trilha</h3>
        <p className="lifecycle-state" role="status">
          {status}
        </p>
      </div>
      <label htmlFor="trail-slug">Slug da trilha</label>
      <input
        id="trail-slug"
        required
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        value={slug}
        onChange={(event) => setSlug(event.target.value)}
      />
      <label htmlFor="trail-category">Categoria da trilha</label>
      <input
        id="trail-category"
        required
        pattern="[0-9a-fA-F-]{36}"
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
      />
      <label htmlFor="trail-title">Titulo da trilha</label>
      <input
        id="trail-title"
        required
        maxLength={180}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <label htmlFor="trail-description">Descricao da trilha</label>
      <textarea
        id="trail-description"
        required
        maxLength={8000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      <div className="step-toolbar">
        <h4>Etapas ordenadas</h4>
        <button className="secondary-button" type="button" onClick={addStep}>
          Adicionar etapa
        </button>
      </div>
      <p aria-live="polite">
        Ordem atual: {steps.map((step) => step.title || 'Sem titulo').join(', ') || 'nenhuma etapa'}
      </p>
      <div className="draft-steps">
        {steps.map((step, index) => (
          <fieldset key={step.id} aria-label={`Etapa ${index + 1}`}>
            <legend>{String(index + 1).padStart(2, '0')}</legend>
            <label htmlFor={`step-title-${step.id}`}>Titulo da etapa {index + 1}</label>
            <input
              id={`step-title-${step.id}`}
              required
              maxLength={180}
              value={step.title}
              onChange={(event) => updateStep(index, { title: event.target.value })}
            />
            <label htmlFor={`step-description-${step.id}`}>Descricao da etapa {index + 1}</label>
            <textarea
              id={`step-description-${step.id}`}
              maxLength={4000}
              value={step.description}
              onChange={(event) => updateStep(index, { description: event.target.value })}
            />
            <label htmlFor={`step-skills-${step.id}`}>
              IDs de habilidades da etapa {index + 1}
            </label>
            <input
              id={`step-skills-${step.id}`}
              value={step.skillIds}
              onChange={(event) => updateStep(index, { skillIds: event.target.value })}
            />
            <label htmlFor={`step-prerequisites-${step.id}`}>
              Pre-requisitos da etapa {index + 1}
            </label>
            <select
              id={`step-prerequisites-${step.id}`}
              multiple
              value={step.prerequisiteIds}
              onChange={(event) =>
                updateStep(index, {
                  prerequisiteIds: Array.from(
                    event.target.selectedOptions,
                    (option) => option.value,
                  ),
                })
              }
            >
              {steps
                .filter((candidate) => candidate.id !== step.id)
                .map((candidate, candidateIndex) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title || `Etapa ${candidateIndex + 1}`}
                  </option>
                ))}
            </select>
            <label className="check-field">
              <input
                type="checkbox"
                checked={step.required}
                onChange={(event) => updateStep(index, { required: event.target.checked })}
              />
              Etapa obrigatoria {index + 1}
            </label>
            <div className="step-order-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={index === 0}
                aria-label={`Mover ${step.title || `etapa ${index + 1}`} para cima`}
                onClick={() => moveStep(index, -1)}
              >
                Subir
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={index === steps.length - 1}
                aria-label={`Mover ${step.title || `etapa ${index + 1}`} para baixo`}
                onClick={() => moveStep(index, 1)}
              >
                Descer
              </button>
            </div>
          </fieldset>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="admin-actions">
        <button type="submit" disabled={pending}>
          Salvar trilha
        </button>
        <button type="button" disabled={!resource || pending} onClick={() => void publish()}>
          Publicar trilha
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!resource || pending}
          onClick={() => void lifecycle('unpublished')}
        >
          Despublicar trilha
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={!resource || pending}
          onClick={() => void lifecycle('inactive')}
        >
          Desativar trilha
        </button>
      </div>
    </form>
  );
}
