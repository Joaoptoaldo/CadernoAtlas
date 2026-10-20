# Documentação do CadernoAtlas

Este é o índice oficial da documentação do CadernoAtlas. Ele organiza os
documentos por finalidade e indica qual arquivo deve ser consultado quando
uma informação tiver uma fonte oficial específica.

O [README principal](../README.md) apresenta o projeto e seu estado atual em
alto nível. Este índice não substitui os documentos detalhados nem pretende
repetir suas regras.

## Visão geral e escopo

- [README principal](../README.md) — visão geral do produto, tecnologias,
  arquitetura do repositório e estado atual. É a fonte oficial do resumo
  geral do projeto.
- [Escopo do MVP](escopo-mvp.md) — escopo funcional do MVP da API, incluindo
  demandas acadêmicas, tarefas, regras iniciais e limites da primeira
  entrega. É a fonte oficial do escopo original/expandido do MVP da API.

O escopo do MVP da API e o roadmap atual da interface Web são referências
distintas: o primeiro define a entrega funcional do backend; o segundo
organiza a evolução da interface que consome os contratos existentes.

## API e contratos

- [Endpoints da API](endpoints.md) — rotas HTTP, parâmetros, contratos,
  exemplos, regras de negócio e códigos de retorno. É a fonte oficial dos
  contratos documentados da API.

## Planejamento da Web

- [Roadmap da interface Web](roadmap-interface-web.md) — fluxo da interface
  de planejamento semanal, mapeamento dos contratos da API, etapas
  incrementais, critérios de conclusão e pendências da Web. É a fonte
  oficial do roadmap atual da interface Web; não altera o escopo do MVP da
  API.

## Decisões arquiteturais

- [ADR 001 — Planejamento semanal determinístico](adr/001-planejamento-semanal-mvp.md)
  — decisões, consequências e critérios do planejamento semanal do MVP. É a
  fonte oficial das decisões arquiteturais registradas nesse tema.

## Desenvolvimento e agentes

- [Fluxo de trabalho para agentes de IA](fluxo-agentes.md) — preparação,
  análise, planejamento, implementação, testes, validação e relato. É a
  fonte oficial do processo recomendado para alterações feitas por agentes.
- [AGENTS.md](../AGENTS.md) — instruções essenciais de desenvolvimento,
  preservação do trabalho, arquitetura, segurança e validação. É a fonte
  oficial das regras gerais para agentes que trabalham no repositório.

## Banco de dados e testes

- [Ambiente local, conexões e migrations](ambiente-postgresql.md) —
  configuração operacional do PostgreSQL, separação de conexões, geração,
  revisão e aplicação controlada de migrations. É a fonte oficial desses
  procedimentos.
- [Testes específicos do PostgreSQL](testes-postgresql.md) — pré-requisitos,
  execução, fixture e cenários da suíte que depende do PostgreSQL real. É a
  fonte oficial dessa categoria de testes e de suas limitações conhecidas.

## Histórico e validações

- [Histórico de implementação e validação](historico-implementacao-e-validacao.md)
  — registro contextual de etapas, decisões observadas e resultados de
  validação datados. É a fonte oficial do registro histórico correspondente,
  mas não substitui o estado atual do [README principal](../README.md), o
  [escopo do MVP](escopo-mvp.md) ou o
  [roadmap da interface Web](roadmap-interface-web.md).

Informações atuais devem ser confirmadas nos documentos de escopo, contratos,
decisões e roadmap indicados acima; o histórico serve para preservar contexto
e evidências de momentos anteriores.

## Manutenção da documentação

### Fontes oficiais

Cada assunto deve ter uma fonte preferencial, sem duplicação desnecessária:

- [endpoints.md](endpoints.md) — contratos HTTP, formatos, parâmetros,
  validações e erros.
- [escopo-mvp.md](escopo-mvp.md) — escopo original do MVP da API.
- [roadmap-interface-web.md](roadmap-interface-web.md) — estado confirmado,
  planejamento, etapas futuras e critérios de conclusão da interface Web.
- [adr/](adr/) — decisões arquiteturais, justificativas e consequências.
- [AGENTS.md](../AGENTS.md) — instruções essenciais para agentes.
- [fluxo-agentes.md](fluxo-agentes.md) — fluxo detalhado de trabalho,
  inspeção e validação.
- [ambiente-postgresql.md](ambiente-postgresql.md) e
  [testes-postgresql.md](testes-postgresql.md) — ambiente PostgreSQL e
  procedimentos de teste relacionados.
- [historico-implementacao-e-validacao.md](historico-implementacao-e-validacao.md)
  — registros históricos datados, não a fonte primária do estado atual.

### Quando atualizar

Revise a documentação relevante na mesma tarefa de desenvolvimento quando
forem alterados contratos ou comportamentos observáveis da API, fluxos ou
limitações da Web, instruções de instalação/configuração/execução/teste,
estrutura relevante ou workflows, decisões arquiteturais ou restrições do
produto. A revisão deve ser proporcional ao impacto; mudanças pequenas não
exigem uma revisão cosmética de todos os documentos.

### Implementação, planejamento e histórico

Não descreva planejamento como implementação. Só altere o estado de um item
do roadmap após conferir o código e as validações pertinentes. Use o roadmap
para orientar etapas e critérios, sem reproduzir os contratos detalhados da
API. Preserve decisões e limites históricos sem reescrevê-los para parecerem
atuais.

Decisões arquiteturais significativas devem ser registradas ou revisadas em
um ADR com contexto, decisão, justificativa, alternativas e consequências.
Escolhas pequenas não precisam de ADR. Mantenha um único documento oficial
por assunto e referencie-o nos demais locais.

Não há roadmaps separados para tarefas e sessões, concursos e editais,
métodos de estudo, gamificação ou acesso remoto neste momento. Eles só devem
ser criados quando o bloco estiver prestes a ser planejado, com escopo e
dependências definidos. Gamificação permanece planejada, não implementada.

### Validação documental

Antes de concluir uma tarefa que altere documentação, verifique os links
relativos afetados, execute `git diff --check`, revise o diff integral,
confirme que não houve alterações não relacionadas e confira o estado
anterior e posterior do Git. Não adicione lint documental, workflows ou
automações apenas para validar documentação.
