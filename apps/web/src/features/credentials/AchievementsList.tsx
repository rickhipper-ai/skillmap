import type { AchievementAward } from './api';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function AchievementsList({ awards }: { awards: AchievementAward[] }) {
  if (awards.length === 0) {
    return (
      <div className="credential-empty">
        <h3>Nenhuma conquista recebida</h3>
        <p>Continue progredindo nas trilhas e registrando suas certificacoes.</p>
      </div>
    );
  }

  return (
    <ul className="achievement-grid">
      {awards.map((award) => (
        <li key={award.achievementId}>
          <p className="achievement-mark" aria-hidden="true">
            +
          </p>
          <h3>{award.title}</h3>
          {award.description && <p>{award.description}</p>}
          <p>Concedida em {dateFormatter.format(new Date(award.awardedAt))}</p>
        </li>
      ))}
    </ul>
  );
}
