export function CatalogChangeNotice() {
  return (
    <div className="progress-notice" role="alert" aria-labelledby="catalog-change-title">
      <h2 id="catalog-change-title">A trilha mudou</h2>
      <p>
        O catalogo foi atualizado. Percentual, requisitos e disponibilidade usam a publicacao mais
        recente; seu historico anterior foi preservado.
      </p>
    </div>
  );
}
