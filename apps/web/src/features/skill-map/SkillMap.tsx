import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { TrailStep } from '../catalog/api';

export function SkillMap({ steps }: { steps: TrailStep[] }) {
  const [showVisual, setShowVisual] = useState(true);
  const titleById = new Map(steps.map((step) => [step.id, step.title]));
  return (
    <div className="skill-map">
      <div className="map-controls" aria-label="Controles do mapa">
        <button
          type="button"
          className="secondary-button"
          aria-pressed={showVisual}
          onClick={() => setShowVisual((value) => !value)}
        >
          {showVisual ? 'Ocultar mapa visual' : 'Mostrar mapa visual'}
        </button>
        <a href="#mapa-textual">Ir para o mapa textual</a>
      </div>
      {showVisual && (
        <ol className="visual-map" aria-label="Mapa visual da trilha">
          {steps.map((step) => (
            <li key={step.id}>
              <span className="step-number" aria-hidden="true">
                {step.position}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <SkillLinks skills={step.skills} />
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="table-scroll" id="mapa-textual">
        <table aria-label="Mapa textual da trilha">
          <thead>
            <tr>
              <th scope="col">Etapa</th>
              <th scope="col">Conteudo</th>
              <th scope="col">Habilidades</th>
              <th scope="col">Requisitos</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.id}>
                <td>{step.position}</td>
                <th scope="row">
                  {step.title}
                  {step.required ? ' (obrigatoria)' : ' (opcional)'}
                  <p>{step.description}</p>
                </th>
                <td>
                  <SkillLinks skills={step.skills} />
                </td>
                <td>
                  {step.prerequisiteStepIds.length
                    ? step.prerequisiteStepIds.map((id) => titleById.get(id) ?? id).join(', ')
                    : 'Nenhum'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkillLinks({ skills }: { skills: TrailStep['skills'] }) {
  if (!skills.length) return <span>Nenhuma habilidade associada</span>;
  return (
    <ul className="inline-list">
      {skills.map((skill) => (
        <li key={skill.id}>
          <Link to={`/habilidades/${skill.id}`}>{skill.title}</Link>
        </li>
      ))}
    </ul>
  );
}
