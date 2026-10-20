# Roadmap atual da interface Web — CadernoAtlas

Este documento orienta a conclusão funcional da interface Web existente.
Ele descreve o estado confirmado no código e nos testes, as dependências entre
as próximas etapas e os critérios para considerar o frontend concluído.

Os contratos HTTP, DTOs, enums, validações e códigos de erro permanecem
documentados em [endpoints.md](endpoints.md). As decisões do algoritmo de
planejamento semanal permanecem em
[adr/001-planejamento-semanal-mvp.md](adr/001-planejamento-semanal-mvp.md).
O escopo do MVP original da API está em [escopo-mvp.md](escopo-mvp.md), e o
índice e as responsabilidades documentais estão em [README.md](README.md).

## 1. Princípios e limites

O fluxo principal da Web deve ajudar o estudante a construir uma semana
possível, sem recalcular prioridades ou alocações no navegador e sem salvar
uma prévia automaticamente. O servidor continua sendo a fonte de verdade do
planejamento.

Este roadmap não altera a API, o banco, as regras de domínio ou o escopo
original do MVP. A interface deve usar os contratos disponíveis e não criar
campos, endpoints ou regras paralelas apenas para atender a uma tela.

A decisão de hospedagem, publicação, domínio, configuração de produção e
demais detalhes operacionais fica deliberadamente adiada até que as
funcionalidades relevantes da API estejam disponíveis pela interface e os
fluxos tenham sido testados e validados. A futura análise de alternativas
também deverá considerar a restrição de custo inicial.

## 2. Estado atual confirmado

### 2.1 Stack e localização

- Frontend em React, TypeScript e Vite, em
  [`src/CadernoAtlas.Web/`](../src/CadernoAtlas.Web/).
- Testes de interface com Vitest, Testing Library e `jsdom`, em
  [`tests/CadernoAtlas.Web.Tests/`](../tests/CadernoAtlas.Web.Tests/).
- Scripts disponíveis em
  [`package.json`](../src/CadernoAtlas.Web/package.json): `dev`, `start`,
  `build`, `lint`, `preview`, `test`, `test:run` e `typecheck`.
- CI do frontend em
  [`node.js.yml`](../.github/workflows/node.js.yml), com instalação via
  `npm ci`, testes, lint e build em Node.js 24.

React + Vite não são uma escolha pendente deste roadmap: são a stack adotada
no estado atual. Uma troca futura exigiria uma decisão específica e não faz
parte destas fases.

### 2.2 Funcionalidades utilizáveis

**Implementada — planejamento semanal:** a tela inicial carrega demandas
priorizadas e disponibilidades, permite trocar a semana, gerar uma prévia,
exibir alocações e atividades não alocadas, e confirmar a proposta. A
confirmação preserva `inicioSemana`, `agora`, `propostaId` e `alocacoes`
retornados pela API; não recalcula esses valores no navegador.

**Implementada — estados do fluxo principal:** há estados de carregamento,
erro localizado, lista vazia, prévia sem alocações, confirmação, conflito
`409`, erro `400`, erro `5xx` e falha de rede. Prévia e confirmação também
impedem envios duplicados durante a operação.

**Implementada — consulta e criação de disponibilidade:** a interface
consulta os intervalos da semana, calcula o total por meio dos horários
recebidos e oferece cadastro de novo intervalo dentro da semana exibida.

**Implementada — consulta, filtros, criação e edição de demandas:** a
interface consulta demandas priorizadas para o planejamento, consulta a lista
completa, filtra por situação, tipo, importância e prazo, cria novas demandas
e atualiza uma demanda existente. Após mutações, invalida a prévia e recarrega
os dados afetados.

**Implementada — gestão de tarefas de demandas:** o cartão de demanda expande
uma lista carregada sob demanda; a interface consulta, cria e edita tarefas
(título, descrição, esforço, situação e ordem). Operações concorrentes
incompatíveis são bloqueadas. A prévia é invalidada após atualizações
confirmadas ou quando o resultado de uma mutação pode ser incerto. Exclusão
(`DELETE`) ainda não está exposta na Web.

**Parcial — qualidade de interface:** o código possui navegação entre
planejamento e demandas, link para pular ao conteúdo principal, estados
semânticos de status/alerta e formulários com validações básicas. Ainda falta
validar completamente teclado, foco, responsividade e comportamento em um
navegador real.

### 2.3 Testes e limitações atuais

Os testes de interface estão organizados em
[`App.availability.test.jsx`](../tests/CadernoAtlas.Web.Tests/App.availability.test.jsx),
[`App.demands.test.jsx`](../tests/CadernoAtlas.Web.Tests/App.demands.test.jsx),
[`App.demand-tasks.test.jsx`](../tests/CadernoAtlas.Web.Tests/App.demand-tasks.test.jsx)
e [`App.planning.test.jsx`](../tests/CadernoAtlas.Web.Tests/App.planning.test.jsx),
com infraestrutura compartilhada em
[`helpers/`](../tests/CadernoAtlas.Web.Tests/helpers/). Eles cobrem os fluxos
separados de disponibilidade, demandas, tarefas e planejamento. São
evidências de comportamento da implementação, não uma afirmação de que todos
os critérios deste roadmap já foram atendidos.

Em 20/10/2026, o [Frontend CI (run 39473717470)](https://github.com/Joaoptoaldo/CadernoAtlas/actions/runs/39473717470)
passou com 74 testes, lint e build. O [.NET CI (run 39473717927)](https://github.com/Joaoptoaldo/CadernoAtlas/actions/runs/39473717927)
passou com 178 testes.

O workflow do frontend já executa testes, lint e build. Ainda permanecem:

- validação dos fluxos contra a API real, em ambiente seguro;
- revisão em navegador real de responsividade, teclado, foco e acessibilidade;
- cobertura de lacunas contratuais e de estados que não estão comprovados nos
  testes atuais;
- implementação ou decisão registrada para os grupos de funcionalidades
  destinados ao usuário final que ainda não aparecem na Web.

## 3. Inventário da API e estado correspondente na Web

As classificações abaixo se referem à interface atual, não à existência dos
endpoints. Os contratos detalhados devem ser consultados em
[endpoints.md](endpoints.md).

| Grupo da API | Estado na Web | Trabalho restante | Critério de aceitação | Dependências |
|---|---|---|---|---|
| Demandas acadêmicas: listar priorizadas, listar com filtros, criar e atualizar | **Implementada** para os fluxos atualmente expostos | Confirmar contra a API real e fechar as lacunas de erro, acessibilidade e validação visual | Usuário consulta, filtra, cria e edita uma demanda sem perder o contexto; respostas e erros do contrato são apresentados corretamente | API de demandas; fluxo de planejamento para invalidar prévias |
| Tarefas vinculadas a demandas | **Implementada parcialmente** | Implementar ou decidir a exclusão (`DELETE`), considerando que a API desvincula tarefas excluídas das sessões relacionadas com `SetNull` | Consulta, criação e edição de tarefas são utilizáveis; a decisão sobre exclusão considera seu efeito nos vínculos de sessões | Demanda selecionada; contratos de tarefas; regras de conclusão da demanda; vínculo com sessões |
| Disponibilidades de estudo: listar e criar | **Implementada** para a fatia semanal | Validar conflitos e recuperação contra a API real; decidir se edição/exclusão serão necessárias quando a API não as oferece | Usuário consulta e cria intervalos na semana, entende vazio, erro e conflito `409`, sem intervalo fora da semana | API de disponibilidades; seletor de semana |
| Sessões de estudo: listar, criar, editar, iniciar, concluir, cancelar e excluir | **Parcial**: sessões são exibidas indiretamente na confirmação do planejamento, sem gerenciamento próprio | Definir a necessidade de uma agenda/histórico e implementar as operações de usuário escolhidas; não inventar telas para endpoints sem decisão | Sessões relevantes podem ser consultadas e, se incluídas no escopo, alteradas conforme os estados permitidos pela API | Contratos e regras de ciclo de vida de sessões; confirmação do planejamento |
| Planejamento semanal: prévia e confirmação | **Implementada** na primeira fatia local | Validar ponta a ponta com API real e concluir revisão de UX, acessibilidade e estados raros | Prévia não persiste; confirmação usa a proposta original; conflito ou erro não reapresenta sucesso nem reenvia payload obsoleto | Demandas, disponibilidades, sessões existentes e decisões do ADR |
| Concursos públicos | **Não iniciada** | Decidir se a vertical de concursos fará parte da interface concluída e, se fizer, implementar CRUD | Usuário consegue realizar as operações incluídas no escopo, com estados vazio, erro e validação | Decisão de escopo; endpoints de concursos |
| Disciplinas de edital | **Não iniciada** | Avaliar como fluxo dependente de concurso e implementar ou justificar exclusão | Disciplinas são gerenciáveis dentro de um concurso quando incluídas | Concursos; contratos de disciplinas |
| Tópicos e subtópicos de edital | **Não iniciada** | Avaliar árvore, ordenação, status, vínculo de disciplina e exclusão em cascata na UX | Usuário consegue consultar e alterar a árvore sem violar as validações da API | Disciplinas; contratos de tópicos; enum textual específico do contrato |
| Cadernos de estudo | **Não iniciada** | Decidir se cadernos terão uma tela no frontend atual e implementar o conjunto escolhido | Operações incluídas são acessíveis e seus estados são verificáveis | Decisão de escopo; endpoints de cadernos |
| Endpoints de desenvolvimento e suporte, como `/_dev/database-check` | **Adiada deliberadamente** | Não expor infraestrutura na interface de usuário; documentar qualquer uso operacional separadamente | Nenhuma tela de produto depende de endpoint de suporte ou revela detalhes de infraestrutura | Ambiente de desenvolvimento e operação da API |

Nenhuma ausência foi tratada silenciosamente como irrelevante. Os grupos
marcados como não iniciados ou parciais exigem uma decisão de escopo quando a
funcionalidade for destinada ao usuário final. A conclusão funcional só poderá
ser declarada depois que cada linha tiver implementação utilizável ou
justificativa registrada.

## 4. Fases de implementação e validação

As fases abaixo não têm datas arbitrárias. Uma fase só avança quando seus
pré-requisitos e critérios objetivos forem atendidos.

### Fase 0 — Fechar o escopo funcional da Web

**Objetivo:** decidir quais grupos da tabela de inventário pertencem à
interface concluída e quais serão justificadamente excluídos.

**Escopo:** tarefas, sessões, concursos, disciplinas, tópicos, subtópicos e
cadernos; confirmar também a necessidade de telas além da primeira fatia de
planejamento.

**Pré-requisitos:** estado atual do frontend, contratos em
[endpoints.md](endpoints.md), escopo do MVP da API em
[escopo-mvp.md](escopo-mvp.md) e decisões do ADR.

**Critérios de aceitação:**

1. Cada linha do inventário tem decisão `incluída`, `excluída com justificativa`
   ou `adiada`.
2. A decisão não altera retroativamente o escopo original da API.
3. Dependências entre grupos estão registradas antes da implementação.

**Testes/verificações:** revisão dos controllers, contratos e fluxos
existentes; atualização deste inventário quando uma decisão for tomada.

**Conclusão da fase:** não há grupo de usuário final sem responsável,
dependência ou decisão de escopo.

### Fase 1 — Consolidar a fatia de demandas, disponibilidade e planejamento

**Objetivo:** transformar o fluxo local já implementado em uma fatia
verificada contra a API real.

**Escopo:** demandas priorizadas e gerenciadas, disponibilidade semanal,
prévia, confirmação, recuperação de erros, navegação e estados vazios.

**Pré-requisitos:** Fase 0; API em execução com os contratos documentados;
ambiente de teste seguro.

**Critérios de aceitação:**

1. A tela consulta os endpoints corretos e não duplica a priorização ou o
   algoritmo de alocação.
2. Criação e edição de demandas e criação de disponibilidade respeitam
   enums, campos opcionais, validações e erros do contrato.
3. A prévia não cria sessões e a confirmação envia os valores recebidos sem
   transformá-los.
4. `400`, `409`, `5xx`, falha de rede, vazio e carregamento têm tratamentos
   distintos e recuperáveis.

**Testes/verificações:** testes de interface existentes e lacunas relevantes;
execução do `test:run`, `lint` e `build`; uma verificação contra a API real sem
apontar para banco inadequado.

**Conclusão da fase:** a primeira fatia passa por um fluxo ponta a ponta
controlado e não possui pendência conhecida que impeça seu uso previsto.

### Fase 2 — Tarefas, sessões e agenda de estudo

**Objetivo:** cobrir os recursos de estudo que sustentam o planejamento, caso
a Fase 0 os inclua na interface final.

**Escopo:** tarefas vinculadas a demandas; consulta e operações escolhidas
para sessões; visualização de sessões confirmadas; consistência entre
situações da API e ações habilitadas.

**Pré-requisitos:** Fase 1; decisão de escopo da Fase 0; contratos e regras de
tarefas e sessões; definição de uma navegação que não confunda prévia com
sessão persistida.

**Critérios de aceitação:**

1. Uma tarefa é sempre apresentada no contexto da demanda correta.
2. A interface não permite ações incompatíveis com o estado da demanda ou da
   sessão e comunica rejeições da API.
3. Sessões confirmadas podem ser identificadas como persistidas, sem
   atribuir conclusão automática à demanda ou à tarefa.
4. A interface não duplica a unidade de planejamento definida no ADR.

**Testes/verificações:** testes de ciclo de vida, estados vazios, `400`,
`404`, `409`, falha de rede e prevenção de ações duplicadas; verificação
contra a API real quando o fluxo estiver implementado.

**Conclusão da fase:** todas as operações incluídas na decisão da Fase 0 têm
fluxo utilizável e testes correspondentes.

### Fase 3 — Vertical de concursos, editais e cadernos

**Objetivo:** implementar ou encerrar com justificativa os grupos legados de
organização de concursos e estudos.

**Escopo:** concursos, disciplinas, tópicos/subtópicos e cadernos, somente
nas operações aprovadas na Fase 0.

**Pré-requisitos:** Fase 0; decisões de navegação; dependências entre
concurso, disciplina e tópico; definição de como cadernos se relacionam com
as telas existentes.

**Critérios de aceitação:**

1. Recursos dependentes não podem ser criados sem o contexto exigido.
2. A árvore de tópicos preserva ordenação, hierarquia e validações do backend.
3. Estados de vazio, carregamento, validação e erro são utilizáveis.
4. Qualquer operação não exposta na Web tem justificativa registrada no
   inventário.

**Testes/verificações:** testes de integração de cada fluxo incluído,
validação dos contratos e revisão de navegação/acessibilidade.

**Conclusão da fase:** a vertical incluída está utilizável ou cada exclusão
foi explicitamente aprovada e documentada.

### Fase 4 — Validação integrada e qualidade de conclusão

**Objetivo:** validar o frontend como produto utilizável, não apenas como
componentes isolados.

**Escopo:** cobertura final, navegador real, responsividade, acessibilidade,
contratos, estados de erro, lint, typecheck, build e CI.

**Pré-requisitos:** todas as fases funcionais incluídas concluídas.

**Critérios de aceitação:**

1. Fluxos principais passam de ponta a ponta contra uma API e banco de teste
   apropriados.
2. Testes cobrem sucesso, vazio, carregamento, validação, `404`, `409`,
   `5xx`, rede e duplo envio onde aplicável.
3. Navegação por teclado, foco, nomes acessíveis e mensagens de estado são
   verificáveis em navegador real.
4. `npm run test:run`, `npm run lint`, `npm run typecheck` e `npm run build`
   passam localmente, e o workflow do frontend passa no CI.

**Testes/verificações:** executar os comandos definidos em
[`package.json`](../src/CadernoAtlas.Web/package.json), revisar os resultados
do workflow e repetir os fluxos críticos após qualquer correção.

**Conclusão da fase:** não restam pendências funcionais conhecidas que
impeçam o uso previsto e os critérios da seção 5 estão comprovados.

### Fase 5 — Conclusão funcional antes da implantação

**Objetivo:** registrar a decisão de que o frontend está funcionalmente
concluído, sem misturar essa decisão com hospedagem.

**Escopo:** checklist final do inventário, evidências de testes e validações,
pendências aceitas e fontes documentais.

**Pré-requisitos:** Fase 4 concluída.

**Critérios de aceitação:**

1. Todos os grupos relevantes da API foram avaliados.
2. Toda funcionalidade de usuário final está utilizável ou tem exclusão
   justificada.
3. Os fluxos principais foram validados ponta a ponta.
4. Contratos são respeitados e regras de negócio não foram duplicadas no
   frontend.
5. Estados de erro, carregamento e ausência de dados estão tratados.
6. Testes, lint, typecheck, build e CI passaram.
7. Não há pendência funcional conhecida que impeça o uso previsto.

**Testes/verificações:** preencher a evidência de cada item, revisar o
inventário e conferir o diff e o estado do Git.

**Conclusão da fase:** somente após todos os itens acima estarem comprovados
o produto poderá entrar na análise de implantação.

### Fase 6 — Implantação, deliberadamente adiada

Esta fase não será executada neste roadmap. Depois da conclusão funcional,
será necessário analisar alternativas de hospedagem, publicação, domínio,
configuração de produção, observabilidade, segurança e custo inicial. Não há
provedor escolhido, infraestrutura criada ou deploy autorizado por este
documento.

## 5. Checklist verificável de conclusão funcional

O frontend só pode ser considerado pronto para a etapa de implantação quando
todos os itens forem marcados com evidência:

- [ ] Todos os grupos de endpoints destinados ao usuário final foram
      implementados ou excluídos com justificativa.
- [ ] O inventário registra o estado, o trabalho restante, a aceitação e as
      dependências de cada grupo.
- [ ] Demandas, disponibilidades e planejamento respeitam os contratos reais.
- [ ] Tarefas, sessões, concursos, editais e cadernos foram decididos e
      tratados conforme o escopo aprovado.
- [ ] Os fluxos principais foram validados ponta a ponta com ambiente seguro.
- [ ] A prévia não é confundida com persistência e a confirmação usa a
      proposta original.
- [ ] Não há duplicação indevida de regras de negócio no frontend.
- [ ] Carregamento, vazio, validação, erro de rede, `400`, `404`, `409` e
      `5xx` são tratados onde aplicável.
- [ ] Navegação, teclado, foco, responsividade e mensagens de estado foram
      revisados em navegador real.
- [ ] Testes relevantes, `npm run lint`, `npm run typecheck`, `npm run build`
      e o CI do frontend passam.
- [ ] Não há pendência funcional conhecida que impeça o uso previsto.
- [ ] A implantação continua separada desta conclusão e permanece sujeita a
      uma análise futura de alternativas e custo.

## 6. Referências de implementação

### Frontend e testes

- [`App.tsx`](../src/CadernoAtlas.Web/src/App.tsx)
- [`PlanningPreview.tsx`](../src/CadernoAtlas.Web/src/features/planning/PlanningPreview.tsx)
- [`ManageDemandsPanel.tsx`](../src/CadernoAtlas.Web/src/features/demands/ManageDemandsPanel.tsx)
- [`CreateDemandForm.tsx`](../src/CadernoAtlas.Web/src/features/demands/CreateDemandForm.tsx)
- [`CreateAvailabilityForm.tsx`](../src/CadernoAtlas.Web/src/features/availability/CreateAvailabilityForm.tsx)
- [`App.availability.test.jsx`](../tests/CadernoAtlas.Web.Tests/App.availability.test.jsx)
- [`App.demands.test.jsx`](../tests/CadernoAtlas.Web.Tests/App.demands.test.jsx)
- [`App.demand-tasks.test.jsx`](../tests/CadernoAtlas.Web.Tests/App.demand-tasks.test.jsx)
- [`App.planning.test.jsx`](../tests/CadernoAtlas.Web.Tests/App.planning.test.jsx)
- [`helpers/`](../tests/CadernoAtlas.Web.Tests/helpers/)

### API e decisões

- [Contratos e endpoints da API](endpoints.md)
- [ADR do planejamento semanal](adr/001-planejamento-semanal-mvp.md)
- [Escopo do MVP original da API](escopo-mvp.md)
- [Índice da documentação](README.md)
