# CadernoAtlas - histórico de implementação e validação

**Estado:** implementação em andamento; validações comuns da API e do frontend aprovadas nesta rodada.

Este documento consolida o estado conhecido do projeto, decisões técnicas registradas e resultados de validação observados até a data acima. Os documentos específicos do repositório continuam sendo a referência detalhada de escopo, regras, endpoints, migrations e roadmap. Não substitui esses documentos.

## 1. Objetivo do projeto

O CadernoAtlas é uma aplicação de organização dos estudos voltada inicialmente a estudantes universitários. O sistema reúne demandas acadêmicas, disponibilidade para estudar, sessões de estudo e planejamento semanal. O projeto também contém áreas relacionadas a cadernos e a conteúdo estruturado de editais, disciplinas e tópicos, que devem ser entendidas conforme o escopo e os endpoints já documentados.

O desenvolvimento está sendo feito de forma incremental: entender o contrato real da API, implementar uma mudança pequena, validar comportamento e tipos, executar testes e registrar decisões antes de iniciar uma mudança maior.

## 2. Estrutura do repositório

| Caminho | Responsabilidade |
|---|---|
| `CadernoAtlas.slnx` | Solução .NET. |
| `src/CadernoAtlas.Api/` | API ASP.NET Core e lógica de domínio/infraestrutura. |
| `tests/CadernoAtlas.Api.Tests/` | Testes automatizados da API. |
| `src/CadernoAtlas.Web/` | Interface React/TypeScript construída com Vite. |
| `tests/CadernoAtlas.Web.Tests/` | Testes automatizados do frontend. |
| `docs/endpoints.md` | Referência detalhada dos endpoints e contratos da API. |
| `docs/escopo-mvp.md` | Escopo do MVP original/expandido da API e funcionalidades existentes. |
| `docs/roadmap-interface-web.md` | Roadmap incremental da interface web, mapeamento de contratos e critérios de conclusão. |
| `docs/ambiente-postgresql.md` | Ambiente local, conexões, migrations e separação de bancos. |
| `docs/testes-postgresql.md` | Pré-requisitos e execução dos testes que dependem do PostgreSQL real. |
| `docs/adr/001-planejamento-semanal-mvp.md` | Decisões arquiteturais do planejamento semanal. |
| `docs/fluxo-agentes.md` | Processo de trabalho, validação e relato para agentes de IA. |

## 3. Tecnologias identificadas

### API e persistência

- .NET 10 (`net10.0`).
- ASP.NET Core e Entity Framework Core.
- PostgreSQL com Npgsql.
- xUnit e `Microsoft.AspNetCore.Mvc.Testing` para testes.
- SQLite em memória para a maioria dos testes HTTP da API.

### Frontend

- React 19.
- TypeScript 7.
- Vite 8.
- Vitest 5, Testing Library e `jsdom` para testes.
- Oxlint para análise estática.
- npm para scripts e dependências.

Os números de versões refletem as configurações consultadas durante esta rodada, não uma promessa de que são as versões mais recentes disponíveis.

## 4. Funcionalidades e fluxos cobertos pela interface web

O fluxo principal documentado para a interface é o planejamento semanal:

1. Carregar as demandas acadêmicas priorizadas e as disponibilidades de estudo para o intervalo consultado.
2. Solicitar e apresentar uma prévia do planejamento semanal.
3. Exibir atividades sugeridas e atividades que não puderam ser alocadas, sem gravar a prévia automaticamente.
4. Confirmar a proposta por meio do endpoint de confirmação.
5. Tratar conflitos HTTP `409` e permitir nova tentativa quando aplicável.
6. Criar uma nova demanda acadêmica a partir do painel de prioridades.

Endpoints principais usados pelo fluxo, conforme a implementação e os documentos consultados:

- `GET /api/demandas-academicas/priorizadas`
- `GET /api/disponibilidades-estudo?dataDe=...&dataAte=...`
- `GET /api/planejamento-semanal/previa?inicioSemana=...`
- `POST /api/planejamento-semanal/confirmar`
- Criação de demanda acadêmica conforme o contrato de `docs/endpoints.md`.

Consulte `docs/endpoints.md` para os caminhos completos, DTOs, enumerações, regras e códigos de retorno. Este resumo não deve ser usado como substituto da documentação de API.

## 5. Etapas de frontend registradas

### 5.1 Organização e tipagem

A interface foi organizada e migrada para TypeScript nos principais pontos do fluxo:

- `src/CadernoAtlas.Web/src/App.tsx`: componente principal e coordenação dos estados e chamadas do fluxo.
- `src/CadernoAtlas.Web/src/main.tsx`: ponto de entrada da aplicação.
- `src/CadernoAtlas.Web/src/features/planning/PlanningPreview.tsx`: apresentação da prévia e estados associados ao planejamento.
- `src/CadernoAtlas.Web/src/utils/planningFormatters.ts`: funções auxiliares de formatação de dados do planejamento.
- `src/CadernoAtlas.Web/src/features/demands/CreateDemandForm.tsx`: formulário para criar demanda acadêmica.
- `src/CadernoAtlas.Web/src/components/ui/Icon.tsx` e `StatusMessage.tsx`: componentes reutilizáveis de interface.

No inventário recebido em outubro, `App.tsx` tinha 710 linhas. Esse tamanho é um dado de diagnóstico, não uma recomendação para fazer uma extração ampla imediatamente. Uma futura refatoração deve ser planejada, ter escopo isolado e preservar o comportamento validado.

### 5.2 Cadastro de demanda acadêmica

O formulário foi integrado ao painel de prioridades acadêmicas. O contrato usado em `CreateDemandForm.tsx` inclui:

- `titulo`: texto obrigatório, normalizado com remoção de espaços nas extremidades;
- `descricao`: texto ou `null`;
- `tipo`: enumeração numérica;
- `prazo`: data ou `null`;
- `importancia`: enumeração numérica;
- `esforcoEstimadoMinutos`: inteiro positivo ou `null`.

O comportamento registrado é:

- Em caso de sucesso, atualizar a lista de demandas, limpar/fechar o formulário e invalidar a prévia de planejamento que ficou desatualizada.
- A criação de demanda não força uma atualização das disponibilidades de estudo, pois essa operação não as altera.
- Em caso de falha, informar o erro e preservar os valores digitados e a prévia existente.
- Enquanto uma requisição de criação estiver em andamento, impedir envios duplicados.
- A atualização global e a confirmação do planejamento continuam atualizando demandas e disponibilidades conforme o fluxo existente.

### 5.3 Testes do frontend

O arquivo `tests/CadernoAtlas.Web.Tests/App.test.jsx` contém nove testes para o fluxo principal. Eles verificam o carregamento inicial, erro ao carregar demandas, apresentação de atividades sugeridas/não alocadas, confirmação da prévia, conflito HTTP `409`, abertura/preenchimento do formulário de demanda, contrato enviado à API, preservação dos dados em erro e prevenção de envios duplicados.

## 6. Decisões importantes sobre persistência e testes

A solução possui duas estratégias de teste de persistência, com objetivos distintos.

### 6.1 Testes comuns da API

`tests/CadernoAtlas.Api.Tests/CustomWebApplicationFactory.cs` configura o ambiente `Testing` e substitui o contexto de dados por SQLite em memória. A factory registra `UseSqlite`; a inicialização comum usa `EnsureCreatedAsync()`.

Isso torna os testes HTTP comuns independentes do banco PostgreSQL local. Porém, SQLite não reproduz todos os comportamentos, tipos ou constraints específicos do PostgreSQL.

### 6.2 Testes específicos do PostgreSQL

`tests/CadernoAtlas.Api.Tests/PostgreSqlSessoesEstudoTests.cs` contém testes marcados com `[Trait("Category", "PostgreSql")]`. Essa suíte lê `CADERNOATLAS_POSTGRES_TEST_CONNECTION_STRING`, valida que o nome do banco termine em `_test`, configura Npgsql e aplica migrations com `MigrateAsync()`.

A execução exige um banco descartável dedicado, documentado como `cadernoatlas_test`. Não use a conexão do banco local de desenvolvimento para esses testes. A string de conexão contém credenciais e nunca deve ser adicionada a documentação, commit, log compartilhado ou arquivo versionado.

Os testes PostgreSQL cobrem, entre outros cenários, sobreposição de sessões ativas, concorrência, atualização de sessões e limites de intervalos. Essa suíte é particularmente importante para validar a constraint PostgreSQL que o SQLite em memória não implementa da mesma maneira.

### 6.3 Migration de sobreposição de sessões

A documentação existente registra a migration `20261017182658_ImpedirSobreposicaoSessoesAtivas` e informa que ela foi aplicada ao banco local por meio de script SQL revisado. A aplicação da migration e a execução dos testes PostgreSQL são evidências diferentes: uma não substitui a outra.

## 7. Procedimentos de validação

Execute os comandos a partir da raiz do repositório, exceto onde indicado.

### 7.1 Frontend

```powershell
Set-Location .\src\CadernoAtlas.Web
npm run typecheck
npm run test:run
npm run lint
npm run build
```

`npm run build` também executa o typecheck antes de criar os artefatos de produção.

### 7.2 Testes comuns da API e build da solução

```powershell
# Execute a partir da raiz do repositório.
dotnet test .\CadernoAtlas.slnx --filter "Category!=PostgreSql" --logger "console;verbosity=minimal"
dotnet build .\CadernoAtlas.slnx --no-restore --verbosity:minimal
```

O filtro exclui explicitamente a categoria que exige PostgreSQL dedicado. Se o build com `--no-restore` falhar por falta de assets restaurados, investigue a saída antes de decidir se é necessário executar `dotnet restore`.

### 7.3 Testes específicos do PostgreSQL

Somente depois de confirmar que existe um banco de teste descartável e isolado, configure a variável na sessão atual do PowerShell e execute:

```powershell
$env:CADERNOATLAS_POSTGRES_TEST_CONNECTION_STRING = "<string-de-conexao-do-banco-dedicado>"
dotnet test .\CadernoAtlas.slnx --filter "Category=PostgreSql"
```

Substitua o marcador localmente. Não cole a connection string em chats, documentação ou logs. Siga `docs/testes-postgresql.md` e `docs/ambiente-postgresql.md` para o procedimento completo.

### 7.4 Verificação do Git

```powershell
git status --short
git diff --check
```

`git diff --check` ajuda a encontrar whitespace problemático em mudanças reconhecidas pelo Git, mas não é suficiente para inspecionar conteúdo de diretórios inteiros ainda não rastreados. Confira também o conteúdo dos novos arquivos. Nenhum arquivo deve ser adicionado ao staging ou commitado sem decisão explícita.

## 8. Resultados observados

Resultados locais informados para **18/10/2026**:

| Verificação | Resultado registrado | Origem |
|---|---|---|
| `dotnet test .\CadernoAtlas.slnx --filter "Category!=PostgreSql"` | 167 aprovados | Execução local informada |
| Testes PostgreSQL (`Category=PostgreSql`) | 11 aprovados, 0 falhas, 0 ignorados | Execução local informada, usando a suíte PostgreSQL dedicada |
| Testes frontend (`npm run test:run`) | 9 aprovados | Execução local informada |
| `npm run typecheck`, `npm run lint` e `npm run build` | Concluídos com sucesso | Execuções locais informadas |
| `dotnet build .\CadernoAtlas.slnx` | Concluído com sucesso | Execução local informada |
| Cadastro manual de duas demandas | Duas demandas persistidas | Validação manual informada no Neon `development` |

A soma das três suítes locais informadas é **187 testes aprovados** (167 + 11 + 9). Esse total agrega execuções distintas; não foi obtido por um único comando e não representa o resultado do CI.

Conforme resultado informado, o CI do backend terminou com sucesso em 18/10/2026: [workflow run 39132920598](https://github.com/Joaoptoaldo/CadernoAtlas/actions/runs/39132920598). O workflow provisiona PostgreSQL 16 e executa os testes .NET sem filtro, incluindo a categoria PostgreSQL. Esse resultado de CI é separado das execuções locais acima.

### O que ainda não foi confirmado nesta rodada

- Não há teste que reproduza especificamente uma falha PostgreSQL `40001` durante a confirmação do planejamento; isso não invalida o resultado geral informado para a suíte PostgreSQL.
- Não foi feita uma medição formal de cobertura de código.
- Não foi relatada uma execução automatizada de testes end-to-end em navegador real.
- O resultado de build/testes não substitui revisão manual de responsividade, acessibilidade, conteúdo visual ou experiência de uso.

## 9. Estado do Git observado durante o levantamento

Em um levantamento anterior de outubro, `git status --short` mostrou estes caminhos como não rastreados:

```text
?? docs/roadmap-interface-web.md
?? src/CadernoAtlas.Web/
?? tests/CadernoAtlas.Web.Tests/
```

Esse é um registro histórico, não o estado atual do Git. O export `cadernoatlas-figma.json` é um arquivo local protegido por uma regra específica no `.gitignore`; a interface, seus testes e os documentos novos ainda precisam de decisão e integração ao versionamento. Nenhum arquivo deve ser adicionado ao staging ou commitado sem decisão explícita.

## 10. Cuidados de encoding

Durante a leitura de arquivos pelo PowerShell, algumas mensagens com acentos apareceram como `tÃtulo` ou `sessÃ£o`. Essa saída isolada não determina se os bytes dos arquivos estão corrompidos ou se a apresentação ocorreu com uma codificação de terminal incompatível. Antes de corrigir textos em massa, confirme a codificação e compare os bytes/conteúdo por um método consistente. Não faça conversões de encoding em lote sem essa verificação.

## 11. Documentação relacionada

- [Roadmap da interface web](roadmap-interface-web.md): plano por etapas, contratos e critérios do frontend.
- [Endpoints da API](endpoints.md): rotas, contratos, regras e códigos de retorno.
- [Escopo do MVP](escopo-mvp.md): objetivo e limites funcionais.
- [Ambiente PostgreSQL](ambiente-postgresql.md): conexões, migrations e separação dos bancos.
- [Testes específicos do PostgreSQL](testes-postgresql.md): pré-requisitos e execução da suíte PostgreSQL.
- [ADR 001 — Planejamento semanal](adr/001-planejamento-semanal-mvp.md): decisões de cálculo, confirmação e integridade.
- [Fluxo de trabalho para agentes](fluxo-agentes.md): procedimento incremental para mudanças e validações.

## 12. Próximos passos sugeridos

1. Executar os testes específicos do PostgreSQL, depois de confirmar a configuração do banco `cadernoatlas_test`, e registrar o resultado real.
2. Conferir a codificação dos arquivos sem alterar indiscriminadamente os documentos existentes.
3. Rever os critérios do roadmap e escolher apenas a próxima mudança de produto ou refatoração, mantendo seu escopo separado.
4. Depois de cada mudança, repetir as validações relevantes, atualizar este histórico com resultados efetivamente observados e conferir o estado do Git.
