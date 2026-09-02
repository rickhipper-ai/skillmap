<!--
Sync Impact Report
- Version change: 1.0.0 -> 2.0.0
- Modified principles:
  - I. Skills Are Auditable Data -> V. Banco de Dados
  - II. Maps Are Deterministic -> III. Arquitetura
  - III. Accessible by Default -> IX. Acessibilidade
  - IV. Verification Before Delivery -> X. Testes
  - V. Simplicity Over Speculation -> I. Simplicidade
- Added principles:
  - II. Experiencia do Usuario
  - IV. Qualidade de Codigo
  - VI. Seguranca
  - VII. API
  - VIII. Responsividade
  - XI. Git
  - XII. Documentacao
- Added sections:
  - Regras Especificas do Dominio
  - Fluxo de Desenvolvimento e Validacao
- Removed sections:
  - Data and Experience Constraints
  - Delivery Workflow
- Follow-up TODOs: None
-->
# SKILL MAPS Constitution

## Core Principles

### I. Simplicidade
O sistema DEVE ser simples de entender, utilizar e manter. Toda funcionalidade DEVE possuir uma
finalidade clara para o usuario e estar vinculada a um requisito aprovado. Abstracoes, dependencias,
camadas ou configuracoes adicionais DEVEM ser rejeitadas quando uma solucao menor atender ao mesmo
requisito. A simplicidade reduz o custo de evolucao e mantem o MVP focado em valor comprovado.

### II. Experiencia do Usuario
A interface DEVE ser intuitiva, moderna, responsiva e acessivel. Em cada fluxo principal, o usuario
DEVE conseguir identificar sua localizacao, seu progresso e o proximo passo recomendado. Estados de
carregamento, vazio, sucesso e erro DEVEM ser compreensiveis e fornecer uma acao adequada. Essas
regras tornam a jornada de desenvolvimento profissional clara e orientada a objetivos.

### III. Arquitetura
Frontend, backend e banco de dados DEVEM possuir responsabilidades, limites e estruturas organizadas
e previsiveis. Regras de negocio NAO DEVEM depender da interface, e detalhes de persistencia NAO
DEVEM vazar para os contratos da API. Arquivos, modulos e componentes DEVEM ser divididos quando
assumirem mais de uma responsabilidade. A separacao reduz acoplamento e permite evolucao incremental.

### IV. Qualidade de Codigo
Variaveis, funcoes, componentes, tabelas e endpoints DEVEM usar nomes claros e descritivos. Funcoes e
componentes DEVEM possuir responsabilidade unica, e codigo semanticamente duplicado DEVE ser
consolidado. Comentarios DEVEM registrar decisoes, restricoes ou motivos nao evidentes e NAO DEVEM
repetir o que o codigo ja expressa. O resultado DEVE ser legivel e verificavel sem conhecimento oculto.

### V. Banco de Dados
O modelo de dados DEVE ser consistente e normalizado quando isso reduzir redundancia sem prejudicar
um requisito medido. Toda tabela DEVE possuir chave primaria; relacionamentos DEVEM usar chaves
estrangeiras; e unicidade, nulabilidade e demais invariantes DEVEM ser impostas pelo banco sempre que
possivel. Alteracoes estruturais DEVEM ocorrer por migrations versionadas e reversiveis ou acompanhadas
de um plano seguro de recuperacao. O historico de progresso NAO DEVE ser apagado por uma atualizacao.

### VI. Seguranca
Senhas NUNCA DEVEM ser armazenadas em texto puro e DEVEM usar algoritmo de hash apropriado para
senhas. Toda entrada externa DEVE ser validada no limite de confianca. Segredos, credenciais e tokens
NAO DEVEM existir no codigo-fonte ou no historico Git e DEVEM ser fornecidos por variaveis de ambiente
ou mecanismo seguro equivalente. Endpoints protegidos DEVEM validar autenticacao e autorizacao no
backend, aplicando o menor privilegio necessario.

### VII. API
A comunicacao entre frontend e backend DEVE utilizar uma API organizada, consistente e versionada
quando houver risco de incompatibilidade. Recursos e endpoints DEVEM ter nomes claros; GET, POST,
PUT/PATCH e DELETE DEVEM representar corretamente leitura, criacao, atualizacao e remocao. Respostas
de erro DEVEM seguir um formato padronizado, compreensivel e sem expor dados sensiveis. Contratos
alterados DEVEM atualizar seus testes e consumidores.

### VIII. Responsividade
Todos os fluxos suportados DEVEM funcionar em desktop, tablet e dispositivos moveis sem depender de
uma resolucao especifica. Conteudo, navegacao e controles NAO DEVEM ficar inacessiveis por quebra de
layout, sobreposicao ou rolagem inadequada. A validacao visual DEVE abranger larguras representativas
dos tres grupos antes da entrega.

### IX. Acessibilidade
HTML semantico DEVE ser utilizado quando aplicavel. Campos DEVEM possuir labels associadas, elementos
interativos DEVEM ser operaveis por teclado e o foco DEVE permanecer visivel e previsivel. Contraste,
legibilidade e estados NAO DEVEM depender somente de cor, posicao ou animacao. Mapas visuais DEVEM
oferecer uma alternativa textual com as mesmas habilidades, relacoes e informacoes de progresso.

### X. Testes
Funcionalidades criticas e regras de negocio DEVEM possuir testes automatizados no menor nivel eficaz.
Regras de negocio DEVEM ser testaveis sem a interface. Integracoes entre banco, backend e frontend
DEVEM ter cobertura para seus contratos relevantes. Toda correcao de bug de impacto relevante DEVE
incluir um teste que falhe antes da correcao e previna a regressao. Testes obrigatorios com falha
bloqueiam a conclusao da alteracao.

### XI. Git
Todo codigo e toda migration DEVEM ser versionados com Git. Senhas, tokens, arquivos `.env` e outras
credenciais NAO DEVEM ser versionados; arquivos de exemplo DEVEM conter apenas valores ficticios.
Cada commit DEVE representar uma alteracao coerente e possuir mensagem clara sobre sua finalidade.
Artefatos gerados ou locais DEVEM ser ignorados quando nao forem entradas necessarias ao projeto.

### XII. Documentacao
O projeto DEVE possuir README com instrucoes verificaveis de instalacao, configuracao e execucao.
Variaveis de ambiente necessarias DEVEM ser documentadas sem valores secretos. Decisoes arquiteturais
que alterem limites, contratos, modelo de dados ou operacao DEVEM registrar contexto, decisao e
consequencias. Documentacao afetada DEVE ser atualizada na mesma alteracao que modifica o comportamento.

## Regras Especificas do Dominio

- O dominio inicial DEVE contemplar usuarios, perfis profissionais, habilidades, categorias de
  habilidades, trilhas de aprendizagem, certificacoes, requisitos de certificacoes, progresso do
  usuario, conquistas e recomendacoes de aprendizagem.
- Uma habilidade DEVE poder pertencer a uma ou mais trilhas sem duplicacao de seu registro canonico.
- Uma trilha DEVE possuir etapas com ordem explicita e persistida.
- Certificacoes DEVEM poder se relacionar a habilidades e trilhas, e seus requisitos DEVEM ser
  representados por relacionamentos verificaveis.
- Atualizacoes de progresso DEVEM preservar eventos ou versoes anteriores para permitir auditoria do
  historico do usuario.
- O modelo DEVE evitar duplicacao desnecessaria e usar entidades e relacionamentos canonicos.
- Certificacoes, habilidades e trilhas DEVEM ser definidas por dados, de modo que novos registros nao
  exijam grandes alteracoes estruturais ou condicionais especificas no codigo.
- Recomendacoes DEVEM declarar os dados e regras usados em sua geracao para que possam ser testadas.

## Fluxo de Desenvolvimento e Validacao

1. Toda funcionalidade DEVE estar associada a um requisito definido na especificacao; interesse
   isolado ou possibilidade futura NAO constitui requisito.
2. Funcionalidades relevantes DEVEM seguir o fluxo: Especificacao -> Clarificacao -> Planejamento ->
   Tarefas -> Implementacao -> Validacao.
3. Ambiguidades significativas DEVEM ser apresentadas ao responsavel pelo requisito ou processadas na
   etapa de clarificacao antes que uma solucao seja assumida.
4. O planejamento DEVE identificar impactos em experiencia, acessibilidade, seguranca, API, banco de
   dados, migrations, compatibilidade e testes.
5. A revisao DEVE verificar os principios desta constituicao, os criterios da especificacao, os testes
   obrigatorios e a documentacao afetada.
6. O primeiro objetivo DEVE ser um MVP funcional; evolucoes DEVEM ser incrementais e justificadas por
   requisitos priorizados.

## Governance

Esta constituicao prevalece sobre praticas, convencoes e decisoes conflitantes do projeto. Toda emenda
DEVE registrar justificativa, principios ou secoes afetados, impacto de versao e plano de migracao
quando aplicavel. A emenda DEVE ser aprovada explicitamente antes que trabalho regido pela nova regra
seja aceito.

As versoes seguem versionamento semantico: MAJOR para remocao ou redefinicao incompativel de principios;
MINOR para novo principio, secao ou ampliacao material de obrigacoes; e PATCH para esclarecimentos sem
mudanca semantica. Toda emenda DEVE atualizar a versao, a data da ultima alteracao e o Sync Impact
Report. A data de ratificacao original DEVE permanecer inalterada.

Cada especificacao, plano, conjunto de tarefas, implementacao e revisao DEVE verificar conformidade
com esta constituicao. Nao conformidades bloqueiam a validacao, salvo excecao documentada com
responsavel, justificativa, risco e prazo de remocao. A conformidade DEVE ser revisada em cada emenda e
antes de releases com alteracoes incompativeis.

**Version**: 2.0.0 | **Ratified**: 2026-09-01 | **Last Amended**: 2026-09-01
