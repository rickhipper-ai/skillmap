import { AchievementForm } from './AchievementForm';
import { CategoryForm } from './CategoryForm';
import { CertificationForm } from './CertificationForm';
import { SkillForm } from './SkillForm';
import { TrailEditor } from './TrailEditor';

export function AdminCatalogPage() {
  return (
    <section className="admin-catalog-page">
      <header className="admin-intro">
        <div>
          <p className="eyebrow">Catalogo versionado</p>
          <h1 tabIndex={-1}>Administracao do catalogo</h1>
        </div>
        <p>
          Edite rascunhos, valide relacionamentos e publique revisoes completas sem alterar o
          historico.
        </p>
      </header>
      <p className="publication-guidance">
        Salve como rascunho e publique para tornar visivel no catalogo.
      </p>
      <section id="categorias" className="admin-section">
        <h2>Categorias</h2>
        <CategoryForm />
      </section>
      <section id="habilidades" className="admin-section">
        <h2>Habilidades</h2>
        <SkillForm />
      </section>
      <section id="trilhas" className="admin-section">
        <h2>Trilhas</h2>
        <TrailEditor />
      </section>
      <section id="certificacoes" className="admin-section">
        <h2>Certificacoes</h2>
        <CertificationForm />
      </section>
      <section id="conquistas" className="admin-section">
        <h2>Conquistas</h2>
        <AchievementForm />
      </section>
    </section>
  );
}
