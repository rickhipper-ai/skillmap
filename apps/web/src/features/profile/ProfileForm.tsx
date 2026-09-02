import { useState, type FormEvent } from 'react';

import { identityRequest } from '../identity/api';

export interface ProfileValue {
  displayName: string;
  currentRoleId: string | null;
  desiredRoleId: string | null;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  interestCategoryIds: string[];
  interestSkillIds: string[];
}

function ids(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProfileForm({ initialProfile }: { initialProfile?: ProfileValue | null }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus('loading');
    try {
      await identityRequest('/v1/users/me', {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: {
          displayName: data.get('displayName'),
          currentRoleId: data.get('currentRoleId') || null,
          desiredRoleId: data.get('desiredRoleId') || null,
          experienceLevel: data.get('experienceLevel'),
          interestCategoryIds: ids(data.get('interestCategoryIds')),
          interestSkillIds: ids(data.get('interestSkillIds')),
        },
      });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  return (
    <form aria-label="Perfil profissional" onSubmit={submit}>
      <label htmlFor="display-name">Nome de exibicao</label>
      <input
        id="display-name"
        name="displayName"
        maxLength={120}
        required
        defaultValue={initialProfile?.displayName}
      />
      <label htmlFor="current-role">
        ID da funcao atual <span className="optional">(opcional)</span>
      </label>
      <input
        id="current-role"
        name="currentRoleId"
        inputMode="text"
        defaultValue={initialProfile?.currentRoleId ?? ''}
      />
      <label htmlFor="desired-role">
        ID da funcao desejada <span className="optional">(opcional)</span>
      </label>
      <input
        id="desired-role"
        name="desiredRoleId"
        inputMode="text"
        defaultValue={initialProfile?.desiredRoleId ?? ''}
      />
      <label htmlFor="experience-level">Nivel de experiencia</label>
      <select
        id="experience-level"
        name="experienceLevel"
        required
        defaultValue={initialProfile?.experienceLevel ?? ''}
      >
        <option value="" disabled>
          Selecione
        </option>
        <option value="beginner">Iniciante</option>
        <option value="intermediate">Intermediario</option>
        <option value="advanced">Avancado</option>
      </select>
      <label htmlFor="interest-categories">
        IDs de categorias de interesse <span className="optional">(separados por virgula)</span>
      </label>
      <input
        id="interest-categories"
        name="interestCategoryIds"
        defaultValue={initialProfile?.interestCategoryIds.join(', ')}
      />
      <label htmlFor="interest-skills">
        IDs de habilidades de interesse <span className="optional">(separados por virgula)</span>
      </label>
      <input
        id="interest-skills"
        name="interestSkillIds"
        defaultValue={initialProfile?.interestSkillIds.join(', ')}
      />
      <button type="submit" disabled={status === 'loading'}>
        Salvar perfil
      </button>
      {status === 'success' ? <p role="status">Perfil salvo.</p> : null}
      {status === 'error' ? (
        <p role="alert">Nao foi possivel salvar. Revise os campos indicados.</p>
      ) : null}
    </form>
  );
}
