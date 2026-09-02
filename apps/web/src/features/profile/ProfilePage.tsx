import { useEffect, useState } from 'react';

import { identityRequest } from '../identity/api';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { ProfileForm, type ProfileValue } from './ProfileForm';

interface CurrentUser {
  profile: ProfileValue | null;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<ProfileValue | null>();
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void identityRequest<CurrentUser>('/v1/users/me', { method: 'GET' })
      .then((user) => {
        if (active) setProfile(user?.profile ?? null);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flow-page profile-page">
      <p className="eyebrow">Seu contexto</p>
      <h1 tabIndex={-1}>Perfil profissional</h1>
      <p>
        Preencha nome e experiencia. Funcao desejada e interesses melhoram futuras recomendacoes.
      </p>
      {profile === undefined && !loadFailed ? <p role="status">Carregando perfil...</p> : null}
      {loadFailed ? (
        <p role="alert">Nao foi possivel carregar o perfil. Voce ainda pode tentar salva-lo.</p>
      ) : null}
      <ProfileForm key={profile ? JSON.stringify(profile) : 'empty'} initialProfile={profile} />
      <DeleteAccountDialog />
    </section>
  );
}
