# ADR 0003: Revisoes, historico e apagamento

- Status: Aceito
- Data: 2026-09-03

## Contexto

Publicacoes de catalogo devem ser atomicas e aplicar imediatamente a usuarios atuais sem reescrever o
passado. Correcoes e concorrencia de progresso devem preservar eventos. Ao mesmo tempo, apagamento de
conta exige remover dados identificaveis em ate 30 dias e tambem de backups restaurados.

## Decisao

Manter raizes canonicas de categoria, habilidade, trilha e certificacao com ponteiro para revisoes
publicadas imutaveis. Rascunhos sao mutaveis e a publicacao valida o grafo completo, cria a revisao em
uma transacao e troca o ponteiro somente ao final. Projecoes de progresso usam sempre a revisao atual;
eventos guardam a revisao observada para auditoria e um marcador informa mudancas ao usuario.

Modelar progresso como stream append-only e projecoes sincronas na mesma transacao. Idempotency keys,
versao-base, lock de stream e ordem persistida tornam repeticao e concorrencia deterministicas.
Correcoes acrescentam evento e nunca atualizam um evento anterior.

Apagamento e a excecao explicita ao historico pessoal: confirmacao muda status e revoga sessoes em uma
transacao, depois um job idempotente limpa provedores e chama uma funcao `SECURITY DEFINER`. A funcao
remove a raiz do usuario para acionar cascatas, elimina links de auditoria e conserva apenas tombstone
nao reversivel e metricas agregadas com pelo menos cinco contribuidores. Um ledger externo de requests
concluidos e reaplicado antes de expor qualquer backup restaurado.

## Alternativas

- Atualizar revisoes e eventos existentes: rejeitado porque perde evidencia, quebra reproducao e pode
  deixar publicacao parcial.
- Event sourcing distribuido/CQRS assincrono: rejeitado; streams e projecoes cabem na mesma transacao e
  banco no MVP.
- Fixar usuarios na revisao antiga: rejeitado pela exigencia de aplicar publicacao atual imediatamente.
- Preservar historico pessoal pseudonimizado indefinidamente: rejeitado porque IDs e combinacoes de
  eventos ainda podem identificar; o requisito permite somente agregado anonimo.
- Confiar apenas na expiracao de backups: rejeitado porque uma restauracao poderia reintroduzir dados
  ja apagados.

## Consequencias

- Consultas precisam distinguir raiz, rascunho, revisao publicada e revisao observada pelo evento.
- Triggers e privilegios impedem mutacao normal; somente o contexto privilegiado e transacional de
  apagamento pode remover historico pessoal.
- Rebuild de projecao deve reproduzir exatamente o stream e a publicacao atual.
- O ledger de apagamento, drill mensal, RPO e RTO tornam-se requisitos operacionais de release.
- Alterar semantica de revisao, stream ou retencao exige migration, plano de recuperacao e novo ADR.
