import type { ProgressHistoryEvent } from './api';

interface ProgressHistoryProps {
  events: ProgressHistoryEvent[];
  stepTitles: ReadonlyMap<string, string>;
}

const states = {
  not_started: 'Nao iniciada',
  in_progress: 'Em andamento',
  completed: 'Concluida',
} as const;

const sources = {
  user: 'Usuario',
  admin_correction: 'Correcao administrativa',
  system: 'Sistema',
} as const;

export function ProgressHistory({ events, stepTitles }: ProgressHistoryProps) {
  const chronological = [...events].sort(
    (left, right) =>
      new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime() ||
      left.eventId - right.eventId,
  );
  return (
    <section className="progress-history" aria-labelledby="progress-history-title">
      <h2 id="progress-history-title">Historico</h2>
      {chronological.length === 0 ? (
        <p>Nenhuma alteracao registrada ainda.</p>
      ) : (
        <ol aria-label="Historico cronologico">
          {chronological.map((event) => (
            <li key={event.eventId}>
              <p>
                <strong>{stepTitles.get(event.stepId) ?? `Etapa ${event.stepId}`}</strong>
                {' - '}
                {states[event.state]}
              </p>
              <p>
                Evento #{event.eventId} por {sources[event.source]} em{' '}
                <time dateTime={event.occurredAt}>
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'UTC',
                  }).format(new Date(event.occurredAt))}
                </time>
                {event.supersedesEventId ? `; corrige o evento #${event.supersedesEventId}` : ''}.
              </p>
              {event.observedRevisionId && (
                <p className="revision-evidence">
                  Publicacao observada: {event.observedRevisionId}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
