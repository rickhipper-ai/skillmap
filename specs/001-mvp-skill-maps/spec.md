# Feature Specification: MVP do SKILL MAPS

**Feature Branch**: `not-created`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Crie a especificacao funcional do MVP do SKILL MAPS conforme a
Constitution do projeto."

## Clarifications

### Session 2026-09-01

- Q: O que deve acontecer quando um usuario solicitar a exclusao da propria conta? -> A: Excluir
  credenciais e dados pessoais em ate 30 dias; preservar somente metricas anonimas.
- Q: Quando uma trilha publicada for alterada, qual versao deve valer para usuarios que ja a
  iniciaram? -> A: Aplicar a versao mais recente, recalcular o progresso e preservar o historico.
- Q: O usuario deve confirmar que controla o endereco de e-mail antes de acessar a conta? -> A:
  Exigir confirmacao do e-mail antes do primeiro acesso.
- Q: O usuario pode registrar renovacoes da mesma certificacao como obtencoes separadas? -> A:
  Registrar cada obtencao ou renovacao separadamente.
- Q: Quando nao houver uma trilha em andamento, quantas recomendacoes o painel deve apresentar? -> A:
  Uma recomendacao principal e ate duas alternativas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Criar conta e perfil profissional (Priority: P1)

Como visitante, quero criar uma conta e informar meu contexto profissional para que o SKILL MAPS
possa apresentar uma experiencia relacionada aos meus objetivos.

**Why this priority**: A conta identifica o usuario e o perfil fornece o contexto minimo para salvar
progresso e orientar sua jornada.

**Independent Test**: Pode ser testada criando uma conta, entrando no sistema, preenchendo e editando
o perfil, o que entrega uma identidade profissional persistente mesmo sem as demais jornadas.

**Acceptance Scenarios**:

1. **Given** um visitante com um e-mail ainda nao cadastrado, **When** ele informa dados validos e
   confirma o cadastro, **Then** sua conta e criada como pendente, ele recebe instrucoes de confirmacao
   e ainda nao pode iniciar uma sessao.
2. **Given** uma conta pendente e uma confirmacao valida, **When** o titular confirma o e-mail,
   **Then** a conta e ativada e ele pode iniciar uma sessao.
3. **Given** um usuario autenticado sem perfil completo, **When** ele informa nome de exibicao, funcao
   atual, funcao desejada, nivel de experiencia e interesses, **Then** o perfil e salvo e exibido para
   revisao.
4. **Given** um e-mail ja cadastrado ou dados obrigatorios invalidos, **When** o cadastro e enviado,
   **Then** nenhuma conta duplicada e criada e o usuario recebe orientacao especifica para corrigir os
   campos.
5. **Given** um usuario que nao lembra sua credencial, **When** solicita recuperacao, **Then** recebe
   instrucoes para recuperar o acesso sem revelar se outro e-mail esta cadastrado.
6. **Given** um usuario autenticado, **When** ele confirma a exclusao da conta, **Then** suas sessoes
   sao encerradas, a conta fica inacessivel e os dados identificaveis sao removidos em ate 30 dias,
   permanecendo somente metricas anonimas.

---

### User Story 2 - Explorar o mapa de aprendizagem (Priority: P1)

Como usuario, quero explorar habilidades, categorias, trilhas e certificacoes para entender as
opcoes de desenvolvimento e como elas se relacionam.

**Why this priority**: Visualizar o dominio de aprendizagem e a proposta central do produto e gera
valor mesmo antes de o usuario registrar progresso.

**Independent Test**: Pode ser testada com um catalogo publicado, navegando, buscando e filtrando os
itens ate consultar os detalhes e relacionamentos de uma trilha, habilidade ou certificacao.

**Acceptance Scenarios**:

1. **Given** um catalogo publicado, **When** o usuario pesquisa por termo ou filtra por categoria,
   **Then** recebe somente habilidades, trilhas e certificacoes correspondentes e pode limpar os
   filtros.
2. **Given** uma trilha com varias etapas, **When** o usuario abre seus detalhes, **Then** visualiza as
   etapas na ordem definida, as habilidades de cada etapa e as certificacoes relacionadas.
3. **Given** uma habilidade presente em mais de uma trilha, **When** o usuario abre a habilidade,
   **Then** visualiza um unico registro da habilidade e todas as trilhas publicadas relacionadas.
4. **Given** uma busca sem resultados, **When** a consulta termina, **Then** o usuario recebe um estado
   vazio compreensivel e uma acao para remover filtros ou alterar a busca.

---

### User Story 3 - Registrar e acompanhar progresso (Priority: P1)

Como usuario autenticado, quero iniciar uma trilha e registrar meu progresso para saber o que ja
conclui sem perder meu historico anterior.

**Why this priority**: O acompanhamento transforma o catalogo em uma ferramenta pessoal de
desenvolvimento e atende a regra central de preservacao do historico.

**Independent Test**: Pode ser testada iniciando uma trilha publicada, alterando etapas entre os
estados permitidos e consultando o resumo e o historico resultantes.

**Acceptance Scenarios**:

1. **Given** um usuario autenticado e uma trilha publicada, **When** ele inicia a trilha, **Then** ela
   aparece em seu progresso com a primeira etapa disponivel e percentual inicial calculado.
2. **Given** uma etapa disponivel, **When** o usuario a marca como em andamento e depois concluida,
   **Then** o estado atual, o percentual da trilha e o historico cronologico sao atualizados.
3. **Given** uma etapa com requisito ainda nao concluido, **When** o usuario tenta conclui-la,
   **Then** a conclusao e bloqueada e os requisitos pendentes sao informados.
4. **Given** uma conclusao registrada incorretamente, **When** o usuario corrige seu progresso,
   **Then** o estado atual e corrigido sem remover o registro anterior do historico.
5. **Given** uma trilha alterada depois de iniciada, **When** o usuario consulta seu progresso,
   **Then** visualiza a versao publicada mais recente, o percentual recalculado, um aviso sobre a
   mudanca e todos os eventos anteriores no historico.

---

### User Story 4 - Receber proximo passo recomendado (Priority: P2)

Como usuario autenticado, quero ver meu progresso consolidado e uma recomendacao explicada para
saber qual acao de aprendizagem realizar em seguida.

**Why this priority**: A recomendacao reduz a indecisao e concretiza a promessa de mostrar ao usuario
onde esta, quanto avancou e qual e o proximo passo.

**Independent Test**: Pode ser testada com um perfil e progresso previamente preparados, verificando
o painel, a recomendacao apresentada e a justificativa baseada em objetivos e requisitos pendentes.

**Acceptance Scenarios**:

1. **Given** um usuario com uma trilha em andamento, **When** abre o painel, **Then** visualiza a trilha,
   o percentual concluido, a ultima atividade e a proxima etapa elegivel.
2. **Given** um usuario sem trilha em andamento, **When** abre o painel, **Then** recebe recomendacoes de
   trilhas publicadas relacionadas a sua funcao desejada e interesses, com uma recomendacao principal
   e ate duas alternativas ordenadas.
3. **Given** uma recomendacao exibida, **When** o usuario consulta o motivo, **Then** visualiza os dados
   do perfil, progresso ou requisitos que justificaram a recomendacao.
4. **Given** que nao ha recomendacao possivel, **When** o painel e exibido, **Then** o usuario recebe uma
   explicacao e uma acao para completar o perfil ou explorar o catalogo.

---

### User Story 5 - Registrar certificacoes e conquistas (Priority: P2)

Como usuario autenticado, quero registrar certificacoes obtidas e visualizar conquistas para reunir
evidencias do meu desenvolvimento profissional.

**Why this priority**: Certificacoes e conquistas ampliam o valor do progresso, mas dependem do
catalogo e da identidade do usuario ja estarem disponiveis.

**Independent Test**: Pode ser testada registrando uma certificacao do catalogo e atingindo um marco
de progresso, verificando o historico e a conquista concedida.

**Acceptance Scenarios**:

1. **Given** uma certificacao publicada, **When** o usuario informa que a obteve e registra data e
   identificador opcional, **Then** a certificacao aparece em seu perfil sem ser tratada como
   verificacao oficial do emissor.
2. **Given** uma certificacao ja registrada, **When** o usuario tenta registrar a mesma obtencao,
   **Then** o sistema evita duplicacao e permite revisar o registro existente.
3. **Given** uma certificacao anteriormente obtida, **When** o usuario registra uma renovacao com nova
   data de obtencao, **Then** um novo registro e criado e as obtencoes anteriores permanecem no
   historico.
4. **Given** que o usuario concluiu o criterio de uma conquista, **When** o progresso e recalculado,
   **Then** a conquista e concedida uma unica vez e permanece no historico.

---

### User Story 6 - Gerenciar o catalogo (Priority: P3)

Como administrador de conteudo, quero cadastrar e publicar categorias, habilidades, trilhas e
certificacoes para manter o mapa de aprendizagem atualizado sem alterar registros existentes.

**Why this priority**: A gestao sustenta a evolucao futura do catalogo, mas o MVP pode ser demonstrado
inicialmente com dados previamente preparados.

**Independent Test**: Pode ser testada com uma conta administrativa criando registros, relacionando
habilidades e certificacoes, ordenando etapas e publicando uma nova trilha para consulta dos usuarios.

**Acceptance Scenarios**:

1. **Given** um administrador autenticado, **When** cria uma habilidade e a associa a duas trilhas,
   **Then** um unico registro da habilidade aparece nas duas trilhas.
2. **Given** uma nova trilha em rascunho, **When** o administrador organiza etapas validas e publica a
   trilha, **Then** ela se torna visivel no catalogo na ordem definida.
3. **Given** um item referenciado por progresso ou por outro item, **When** o administrador tenta
   remove-lo, **Then** a remocao destrutiva e bloqueada e a opcao de desativacao e oferecida.
4. **Given** um usuario sem permissao administrativa, **When** tenta executar uma acao de gestao,
   **Then** a acao e negada sem alterar o catalogo.

### Edge Cases

- Uma trilha nao pode ser publicada sem titulo, descricao, categoria e ao menos uma etapa valida.
- Uma etapa nao pode depender de si mesma nem formar um ciclo de requisitos dentro da trilha.
- Conteudo desativado permanece no historico de quem o utilizou, mas nao pode ser iniciado por novos
  usuarios nem aparecer como recomendacao.
- Alteracoes publicadas na ordem, nas etapas ou nos requisitos de uma trilha passam a valer para todos
  os usuarios, recalculam o percentual e o proximo passo, preservam o historico e exibem um aviso aos
  usuarios afetados.
- Duas atualizacoes concorrentes do mesmo progresso devem resultar em um unico estado atual e manter
  ambos os eventos recebidos, sinalizando ao usuario quando uma revisao for necessaria.
- Falhas ao carregar ou salvar devem preservar os dados ja confirmados, informar que a acao nao foi
  concluida e oferecer nova tentativa sem duplicar registros.
- Textos muito longos, caracteres inesperados e entradas malformadas devem ser rejeitados ou
  apresentados com seguranca, com indicacao do campo que precisa ser corrigido.
- Um usuario sem progresso, sem interesses ou com todas as trilhas concluidas deve receber um estado
  vazio e uma acao util, nunca um painel em branco.

## Requirements *(mandatory)*

### Scope

**In Scope**:

- Cadastro, acesso, recuperacao de acesso e perfil profissional individual.
- Consulta ao catalogo de habilidades, categorias, trilhas, etapas e certificacoes.
- Inicio de trilhas, registro de progresso com historico, painel e recomendacoes explicadas.
- Registro autodeclarado de certificacoes e concessao automatica de conquistas basicas.
- Gestao restrita do catalogo por administradores de conteudo.
- Experiencia responsiva e acessivel nos fluxos definidos nesta especificacao.

**Out of Scope**:

- Validacao de certificacoes diretamente com emissores ou integracao com plataformas de cursos.
- Pagamentos, assinaturas, marketplace ou venda de conteudo.
- Recursos sociais, mentoria, equipes, ranking publico ou compartilhamento entre usuarios.
- Recomendacoes preditivas ou geradas por inteligencia artificial.
- Aplicativos nativos, operacao offline e notificacoes por dispositivo.
- Importacao em massa, relatorios organizacionais e administracao de multiplas organizacoes.

### Functional Requirements

- **FR-001**: O sistema DEVE permitir que visitantes criem uma conta com e-mail unico e credencial
  secreta, exigindo aceite dos termos aplicaveis.
- **FR-002**: O sistema DEVE permitir inicio e encerramento de sessao e recuperacao segura de acesso.
- **FR-003**: O sistema DEVE impedir que um usuario consulte ou altere perfil, progresso,
  certificacoes ou conquistas pertencentes a outro usuario.
- **FR-004**: O usuario DEVE poder criar e editar um perfil com nome de exibicao, funcao atual, funcao
  desejada, nivel de experiencia e interesses profissionais.
- **FR-005**: O sistema DEVE indicar quais dados obrigatorios do perfil estao ausentes antes de usa-los
  para recomendar uma trilha.
- **FR-006**: Visitantes e usuarios autenticados DEVEM poder consultar itens publicados do catalogo.
- **FR-007**: O catalogo DEVE permitir busca por texto e filtros por categoria e tipo de item, com
  opcao para remover todos os filtros.
- **FR-008**: Cada habilidade DEVE apresentar descricao, categoria e todas as trilhas e certificacoes
  publicadas com as quais se relaciona.
- **FR-009**: Cada trilha DEVE apresentar descricao, categoria, etapas em ordem explicita, habilidades
  de cada etapa, requisitos e certificacoes relacionadas.
- **FR-010**: Cada certificacao DEVE apresentar emissor, descricao, habilidades, trilhas e requisitos
  relacionados, quando existentes.
- **FR-011**: Um usuario autenticado DEVE poder iniciar uma trilha publicada e consultar seu estado
  atual a qualquer momento.
- **FR-012**: O progresso de cada etapa DEVE aceitar os estados nao iniciada, em andamento e concluida,
  com data e origem de cada alteracao.
- **FR-013**: O sistema DEVE bloquear a conclusao de uma etapa enquanto seus requisitos obrigatorios
  nao estiverem concluidos e DEVE identificar os requisitos pendentes.
- **FR-014**: Toda alteracao de progresso DEVE acrescentar um evento ao historico; correcoes DEVEM
  produzir novo evento sem editar ou excluir eventos anteriores.
- **FR-015**: O sistema DEVE calcular o percentual da trilha pelo numero de etapas obrigatorias
  concluidas em relacao ao total de etapas obrigatorias publicadas.
- **FR-016**: O painel DEVE mostrar trilhas em andamento, percentual concluido, ultima atividade,
  certificacoes registradas, conquistas e o proximo passo recomendado.
- **FR-017**: A recomendacao DEVE priorizar a proxima etapa elegivel de uma trilha em andamento; na
  ausencia dela, DEVE apresentar uma trilha principal e ate duas alternativas ordenadas pela relacao
  com a funcao desejada e os interesses do perfil.
- **FR-018**: Cada recomendacao DEVE apresentar uma justificativa baseada no perfil, no progresso ou
  nos requisitos que determinaram sua posicao.
- **FR-019**: O usuario DEVE poder registrar uma certificacao publicada como obtida, informando data
  de obtencao e, opcionalmente, identificador e data de validade.
- **FR-020**: O registro de certificacao do MVP DEVE ser identificado como autodeclarado e NAO DEVE
  indicar validacao oficial pelo emissor.
- **FR-021**: O sistema DEVE conceder uma conquista uma unica vez quando o usuario atingir o criterio
  publicado e DEVE preservar a data da concessao.
- **FR-022**: Administradores de conteudo DEVEM poder criar, editar, relacionar, ordenar, publicar,
  despublicar e desativar categorias, habilidades, trilhas, etapas, certificacoes e seus requisitos.
- **FR-023**: O sistema DEVE validar unicidade dos registros canonicos e impedir relacionamentos
  inexistentes, autorreferentes ou ciclicos quando representarem requisitos.
- **FR-024**: Itens referenciados por progresso ou por outros itens NAO DEVEM ser excluidos de forma
  destrutiva; eles DEVEM poder ser desativados preservando relacionamentos historicos.
- **FR-025**: Novas habilidades, trilhas e certificacoes DEVEM poder ser adicionadas pelo mesmo fluxo
  de gestao sem exigir alteracao dos registros existentes.
- **FR-026**: A interface DEVE apresentar estados distintos de carregamento, vazio, sucesso e erro nos
  fluxos de cadastro, catalogo, progresso, painel e gestao.
- **FR-027**: Todos os fluxos em escopo DEVEM permanecer operaveis em larguras representativas de
  desktop, tablet e dispositivo movel, sem ocultar conteudo ou acoes obrigatorias.
- **FR-028**: Todos os fluxos em escopo DEVEM ser operaveis por teclado, possuir foco visivel, nomes
  acessiveis para controles e alternativa textual para relacoes apresentadas visualmente.
- **FR-029**: O sistema DEVE validar toda entrada do usuario, associar erros aos campos correspondentes
  e impedir que conteudo fornecido seja interpretado como instrucao executavel.
- **FR-030**: Operacoes protegidas DEVEM exigir usuario autenticado e permissoes compativeis com o
  papel de usuario comum ou administrador de conteudo.
- **FR-031**: Mensagens de erro NAO DEVEM revelar credenciais, dados pessoais de terceiros ou detalhes
  internos que facilitem acesso indevido.
- **FR-032**: Acoes administrativas e eventos relevantes de acesso e seguranca DEVEM gerar registros
  auditaveis com ator, acao, resultado e data.
- **FR-033**: O usuario autenticado DEVE poder solicitar e confirmar a exclusao da conta; o sistema
  DEVE encerrar suas sessoes, impedir novos acessos e remover credenciais e todos os dados que permitam
  identifica-lo em ate 30 dias, preservando somente metricas agregadas anonimas.
- **FR-034**: Toda alteracao publicada em uma trilha DEVE passar a valer para usuarios novos e atuais;
  o sistema DEVE recalcular o percentual e o proximo passo pela publicacao mais recente, preservar os
  eventos anteriores e informar os usuarios cujo progresso tenha sido afetado.
- **FR-035**: Uma conta nova DEVE permanecer pendente e sem acesso autenticado ate que o titular
  confirme o endereco de e-mail; somente uma confirmacao valida DEVE ativar a conta.
- **FR-036**: Cada obtencao ou renovacao de uma certificacao DEVE gerar um registro separado; o sistema
  DEVE rejeitar somente a repeticao da mesma certificacao, data de obtencao e identificador para o
  mesmo usuario e DEVE preservar todos os registros anteriores.

### Key Entities *(include if feature involves data)*

- **Usuario**: Identidade de acesso unica; possui um perfil profissional, papeis de permissao,
  progresso, certificacoes registradas, conquistas e estado pendente, ativo ou em exclusao.
- **Perfil Profissional**: Contexto do usuario composto por nome de exibicao, funcao atual, funcao
  desejada, nivel de experiencia e interesses.
- **Categoria de Habilidade**: Classificacao canonica que agrupa habilidades e apoia filtros.
- **Habilidade**: Competencia canonica e unica; pertence a uma categoria e pode se relacionar a varias
  trilhas e certificacoes.
- **Trilha de Aprendizagem**: Jornada publicada ou em rascunho, composta por etapas ordenadas e
  relacionada a uma categoria, habilidades e certificacoes.
- **Etapa da Trilha**: Unidade ordenada de uma trilha; referencia habilidades e pode exigir a
  conclusao de outras etapas sem formar ciclos.
- **Certificacao**: Credencial profissional de um emissor; relaciona habilidades, trilhas e requisitos
  necessarios para sua obtencao.
- **Requisito de Certificacao**: Condicao canonica associada a uma certificacao, podendo referenciar
  habilidades ou trilhas.
- **Evento de Progresso**: Registro imutavel de uma mudanca de estado de etapa, com usuario, estado,
  data e origem; varios eventos determinam o estado atual sem apagar o historico.
- **Registro de Certificacao**: Declaracao do usuario de que obteve uma certificacao, com data de
  obtencao, identificador opcional, validade opcional e indicacao de nao verificacao; cada obtencao ou
  renovacao e distinta e permanece no historico.
- **Conquista**: Marco com criterio publicado; sua concessao relaciona usuario, conquista e data uma
  unica vez.
- **Recomendacao de Aprendizagem**: Proximo passo ordenado para um usuario, acompanhado dos dados e da
  regra que justificam a recomendacao.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pelo menos 90% dos participantes de um teste de usabilidade conseguem criar conta,
  completar o perfil e iniciar uma trilha em ate 5 minutos, sem ajuda externa.
- **SC-002**: Pelo menos 95% dos usuarios conseguem identificar seu percentual de progresso e o
  proximo passo recomendado em ate 10 segundos apos abrir o painel.
- **SC-003**: Em 95% das consultas, usuarios visualizam o conteudo principal do catalogo ou painel em
  ate 2 segundos, com ate 500 usuarios ativos simultaneamente.
- **SC-004**: Em 100% dos cenarios de atualizacao, correcao e mudanca de trilha validados, o historico
  anterior de progresso permanece consultavel e cronologicamente consistente.
- **SC-005**: 100% dos fluxos criticos de cadastro, catalogo, progresso e painel podem ser concluidos
  somente por teclado e em larguras representativas de desktop, tablet e dispositivo movel.
- **SC-006**: Pelo menos 90% dos participantes encontram uma habilidade, uma trilha e uma certificacao
  especificas na primeira tentativa, usando busca ou filtros.
- **SC-007**: Um administrador treinado consegue criar e publicar uma trilha com cinco etapas, dez
  habilidades e uma certificacao relacionada em ate 15 minutos, sem duplicar registros canonicos.
- **SC-008**: 100% das tentativas validadas de acesso anonimo ou por outro usuario a dados protegidos
  sao negadas sem alterar ou revelar os dados alvo.
- **SC-009**: A satisfacao media dos participantes com clareza de navegacao, progresso e proximo passo
  atinge ao menos 4 de 5 em teste de usabilidade do MVP.
- **SC-010**: Em 100% dos cenarios validados de exclusao de conta, o acesso e bloqueado imediatamente
  e nenhum dado capaz de identificar o usuario permanece apos 30 dias.
- **SC-011**: Em 100% das tentativas validadas, uma conta com e-mail nao confirmado permanece sem
  acesso autenticado ate receber uma confirmacao valida.
- **SC-012**: Em 100% dos cenarios validados de renovacao de certificacao, a nova obtencao e criada sem
  alterar ou remover as obtencoes anteriores.

## Assumptions

- O MVP atende profissionais de tecnologia que acessam a plataforma individualmente e possuem
  conectividade durante o uso.
- O catalogo inicial sera preparado e revisado por responsaveis de conteudo antes da validacao do MVP.
- O volume inicial esperado e de ate 1.000 habilidades, 200 trilhas, 500 certificacoes e 10.000
  usuarios cadastrados, com ate 500 usuarios ativos simultaneamente.
- O conteudo e a interface do MVP usam portugues; internacionalizacao para outros idiomas fica para
  uma especificacao futura.
- A recuperacao de acesso depende de um canal transacional capaz de entregar instrucoes ao titular do
  e-mail informado.
- Certificacoes sao autodeclaradas no MVP; nao existe dependencia de emissores externos.
- Recomendacoes usam apenas regras explicitas sobre perfil, progresso, relacionamentos e requisitos do
  catalogo; personalizacao preditiva nao faz parte deste escopo.
- Conquistas iniciais correspondem a marcos simples e publicados, como concluir a primeira etapa,
  concluir uma trilha ou registrar uma certificacao.
