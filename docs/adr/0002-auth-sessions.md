# ADR 0002: Autenticacao e sessoes

- Status: Aceito
- Data: 2026-09-03

## Contexto

Contas precisam confirmar e-mail antes de acesso, recuperar senha sem enumeracao, revogar todas as
sessoes imediatamente e impedir acesso no inicio do apagamento. O navegador e o consumidor inicial e
operacoes mutaveis estao sujeitas a CSRF.

## Decisao

Usar Better Auth como fachada com adaptador Kysely/PostgreSQL e credenciais locais Argon2id. Sessoes sao
tokens opacos aleatorios; somente SHA-256 do token e persistido. O cookie canonico e host-only
`__Host-skillmaps-session`, `HttpOnly`, `Secure`, `SameSite=Lax` e `Path=/`. Cache de sessao em cookie e
desativado para que status, expiracao, papeis, reset e apagamento sejam observados no banco a cada
request protegido.

E-mail confirmado e status `active` sao pre-condicoes no backend. Escritas exigem origem exatamente
igual a `WEB_ORIGIN` e token CSRF double-submit comparado em tempo constante. Autorizacao usa papel
`content_admin` e escopo do usuario atual no backend; o frontend nunca concede permissao. Reset revoga
sessoes e respostas de solicitacao nao revelam existencia de conta.

## Alternativas

- JWT autocontido: rejeitado porque revogacao imediata exigiria lista de bloqueio/cache e poderia manter
  papeis/status antigos.
- Token de sessao em local storage: rejeitado pela exposicao a JavaScript e maior impacto de XSS.
- Cookie `SameSite=Strict` sem token CSRF: rejeitado porque SameSite nao substitui validacao de origem e
  token, e `Lax` preserva navegacao segura esperada.
- Senha com hash generico rapido: rejeitado; Argon2id e configurado para password hashing.

## Consequencias

- Toda request autenticada consulta PostgreSQL; indisponibilidade do banco fecha o acesso em vez de
  aceitar estado possivelmente revogado.
- Cookies `Secure` exigem HTTPS fora do proxy local; staging deve verificar atributos e TLS.
- Segredos de auth e SMTP devem vir do secret manager e ser rotacionaveis.
- Alteracao do nome/formato do cookie ou do modelo de sessao exige migracao coordenada e novo ADR.
