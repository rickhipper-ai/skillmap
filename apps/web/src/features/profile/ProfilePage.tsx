import { useAuthenticatedUser } from '../identity/AuthenticatedLayout';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { ProfileForm, type ProfileValue } from './ProfileForm';

export function ProfilePage() {
  const { profile } = useAuthenticatedUser();
  const initialProfile: ProfileValue | null = profile
    ? {
        displayName: profile.displayName ?? '',
        currentRoleId: profile.currentRoleId ?? null,
        desiredRoleId: profile.desiredRoleId ?? null,
        experienceLevel: profile.experienceLevel ?? 'beginner',
        interestCategoryIds: profile.interestCategoryIds ?? [],
        interestSkillIds: profile.interestSkillIds ?? [],
      }
    : null;

  return (
    <section className="flow-page profile-page">
      <p className="eyebrow">Seu contexto</p>
      <h1 tabIndex={-1}>Perfil profissional</h1>
      <p>
        Preencha nome e experiencia. Funcao desejada e interesses melhoram futuras recomendacoes.
      </p>
      <ProfileForm
        key={initialProfile ? JSON.stringify(initialProfile) : 'empty'}
        initialProfile={initialProfile}
      />
      <DeleteAccountDialog />
    </section>
  );
}
