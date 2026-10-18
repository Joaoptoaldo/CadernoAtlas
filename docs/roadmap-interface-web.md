# Roadmap da interface web — CadernoAtlas

**Escopo deste documento:** mapear a interface de planejamento semanal para os contratos existentes e definir uma ordem incremental de implementação. Não propõe alteração imediata da API, do banco, da regra de planejamento ou da arquitetura.

## 1. Objetivo e princípio de produto

Implementar a primeira interface web do CadernoAtlas focada no planejamento semanal de estudantes universitários. O fluxo deve ajudar a pessoa a decidir o que cabe na rotina real, sem preencher todos os horários artificialmente nem tratar uma semana incompleta como falha pessoal.

Princípio de produto: **“Uma semana possível. Seu planejamento deve caber na sua rotina, não o contrário.”**

A primeira fatia da interface deve permitir:

1. consultar as demandas acadêmicas ativas e as disponibilidades já cadastradas;
2. escolher uma semana e pedir uma prévia ao servidor;
3. revisar sessões sugeridas e atividades que não couberam, incluindo os motivos;
4. confirmar a proposta explicitamente;
5. recuperar-se de dados desatualizados ou conflitos, gerando uma nova prévia.

A tela não deve recalcular prioridades/alocações no navegador nem persistir uma prévia por conta própria. O servidor é a fonte de verdade do planejamento.

## 2. Estado funcional e pendências

### Implementado

- Interface React + Vite para consultar demandas priorizadas e disponibilidades, selecionar semana, solicitar e revisar a prévia e confirmar o planejamento.
- Cadastro de demanda acadêmica a partir do painel de prioridades, com atualização da lista após criação.
- Tratamento de conflitos `409`, estados de carregamento e erros recuperáveis.
- Nove testes automatizados de interface cobrindo carregamento inicial, repetição após falha de demandas, prévia sem persistência, confirmação, conflito `409` e cadastro de demanda (contrato, erro e envio duplicado).

### Cobertura e integração pendentes

Os nove testes existentes não cobrem todos os cenários listados nos critérios de conclusão da seção 7. Permanecem lacunas para estados vazios e prévia sem alocações, falha de carregamento de disponibilidades, respostas `400`, falhas de rede na confirmação e revisão em navegador real de responsividade, teclado e acessibilidade.

A interface e seus testes ainda não foram integrados ao histórico normal do Git nem aos passos de CI do frontend. Esse é um estado temporário de versionamento e automação; não altera o fato de que os fluxos descritos acima estão implementados localmente. A estratégia de hospedagem de produção também continua pendente. O proxy Vite atende ao desenvolvimento local, mas não define o deploy.

Os contratos e referências de API consultados para este roadmap permanecem listados na seção de referência ao final.

## 3. Inventário dos contratos reais

Os caminhos e nomes abaixo foram verificados nos contratos e no código da API consultados para este roadmap. Os exemplos de nomes JSON usam o padrão camelCase habitual do ASP.NET Core.

### 3.1 Prévia do planejamento

**`GET /api/planejamento-semanal/previa?inicioSemana=yyyy-MM-dd`**\
Controller: `PlanejamentoSemanalController.ObterPrevia`\
Request query: `inicioSemana` é obrigatório e deve ser uma data válida que caia em uma segunda-feira. Não enviar `agora` como parâmetro: o instante é obtido no servidor por `TimeProvider`.

**Resposta `200 OK` (`PlanejamentoSemanalResponse`):**

```json
{
  "inicioSemana": "2026-10-19",
  "agora": "2026-10-18T12:00:00-03:00",
  "propostaId": "hmac-sha256:...",
  "alocacoes": [
    {
      "demandaAcademicaId": 12,
      "tarefaDemandaId": null,
      "titulo": "Revisar conteúdo da prova",
      "dataPlanejada": "2026-10-19",
      "horaInicio": "19:00:00",
      "duracaoPlanejadaMinutos": 60
    }
  ],
  "naoAlocadas": [
    {
      "demandaAcademicaId": 14,
      "tarefaDemandaId": null,
      "titulo": "Leitura do capítulo",
      "motivo": 2,
      "descricao": "..."
    }
  ]
}
```

O JSON acima é ilustrativo do formato e não representa dados reais do banco. Os IDs podem ser nulos conforme a unidade de planejamento.

- `alocacoes`: lista de atividades sugeridas. Cada item contém `demandaAcademicaId`, `tarefaDemandaId`, `titulo`, `dataPlanejada`, `horaInicio` e `duracaoPlanejadaMinutos`.
- `naoAlocadas`: lista das atividades elegíveis que não receberam horário, com `motivo` e `descricao` para explicar o resultado.
- `propostaId`: identificador assinado que precisa ser preservado literalmente para a confirmação. O front-end não deve criar, transformar ou recalcular esse valor.
- A resposta também inclui `inicioSemana` e `agora`, ambos necessários para confirmar a mesma proposta.

**Status observados/testados:** `200 OK` em caso de sucesso; `400 Bad Request` quando a semana está ausente, tem formato inválido, não cai numa segunda-feira ou ultrapassa a faixa de datas suportada. `GET` calcula a proposta sem persistir sessões.

### 3.2 Confirmação do planejamento

**`POST /api/planejamento-semanal/confirmar`**\
Controller: `PlanejamentoSemanalController.Confirmar`\
Body (`ConfirmarPlanejamentoSemanalRequest`):

```json
{
  "inicioSemana": "2026-10-19",
  "agora": "2026-10-18T12:00:00-03:00",
  "propostaId": "hmac-sha256:...",
  "alocacoes": [
    {
      "demandaAcademicaId": 12,
      "tarefaDemandaId": null,
      "titulo": "Revisar conteúdo da prova",
      "dataPlanejada": "2026-10-19",
      "horaInicio": "19:00:00",
      "duracaoPlanejadaMinutos": 60
    }
  ]
}
```

Enviar os valores da prévia sem modificá-los: `inicioSemana`, `agora`, `propostaId` e `alocacoes`. Não enviar `naoAlocadas` no corpo de confirmação. A proposta é stateless; a API recarrega os dados, recalcula o resultado e valida se a proposta continua íntegra e no futuro.

**Resposta `200 OK` (`ConfirmarPlanejamentoSemanalResponse`):** `inicioSemana`, `agora` e `sessoesCriadas`, sendo cada sessão criada uma `SessaoEstudoResponse` com `id`, `titulo`, `dataPlanejada`, `horaInicioPlanejada`, `duracaoPlanejadaMinutos`, `duracaoRealMinutos`, `situacao`, `demandaAcademicaId`, `tarefaDemandaId`, `observacoes`, `criadoEm`, `inicioRealEm`, `concluidaEm` e `canceladaEm`.

**Status e recuperação:**

- `400 Bad Request`: início de semana ou proposta incompletos/inválidos, ou alocação nula. Exibir a mensagem da API de maneira legível; não presumir que o caso será corrigido por tentar novamente sem alterar nada.
- `409 Conflict`: proposta desatualizada ou adulterada, alocação que deixou de estar no futuro, sobreposição com sessão ativa ou conflito transacional. O controller devolve `ProblemDetails` com `title` e `detail` em casos tratados.
- `200 OK`: confirmação concluída; usar `sessoesCriadas` para apresentar o resultado confirmado.
- Erros de rede e respostas `5xx`: estado recuperável de falha, sem assumir que a confirmação foi concluída quando não há resposta. Em caso de resultado ambíguo após falha de conexão, consultar as sessões existentes ou gerar uma nova prévia antes de repetir uma ação de escrita.

A confirmação usa transação `Serializable`; as falhas PostgreSQL `23P01` para a constraint de sobreposição ativa e `40001` de serialização são convertidas em `409 Conflict`. O front-end não precisa conhecer nem interpretar esses códigos SQL: deve tratar o status HTTP e a mensagem de problema.

### 3.3 Lista priorizada de demandas

**`GET /api/demandas-academicas/priorizadas`**\
Controller: `DemandasAcademicasController.ListarPriorizadas`\
Sem parâmetros. Retorna apenas demandas em situação `Pendente` ou `EmAndamento`, ordenadas pela regra de prioridade existente.

Formato por item: `demanda` (objeto `DemandaAcademicaResponse`), `faixaUrgencia`, `diasAtePrazo` e `justificativa`.

Campos de `demanda`: `id`, `titulo`, `descricao`, `tipo`, `prazo`, `importancia`, `esforcoEstimadoMinutos`, `situacao` e `criadoEm`.

- `prazo` e `esforcoEstimadoMinutos` podem ser nulos; a interface deve mostrar “Sem prazo” ou “A estimar”, conforme o caso.
- O endpoint já retorna a ordenação da prioridade. Não reordenar no navegador por uma regra paralela.
- A resposta priorizada contém **demandas-pai**, não a lista expandida de tarefas usada pelo planejador.
- `200 OK` em caso de sucesso. Falhas de transporte/servidor devem aparecer em um estado com ação de tentar novamente.

O endpoint `GET /api/demandas-academicas` também existe, com filtros opcionais `situacao`, `tipo`, `importancia` e `prazoAte=yyyy-MM-dd`. Sem filtro de situação, ele também pode incluir demandas concluídas/canceladas e ordena por título; por isso, a lista `priorizadas` é a fonte mais adequada para o painel principal.

### 3.4 Disponibilidade semanal

**`GET /api/disponibilidades-estudo?dataDe=yyyy-MM-dd&dataAte=yyyy-MM-dd`**\
Controller: `DisponibilidadesEstudoController.Listar`. Os parâmetros são opcionais; para o painel semanal, enviar as datas da segunda-feira e do domingo selecionados.

Retorna um array de `{ id, data, horaInicio, horaFim, criadoEm }`, ordenado por data e horário. Retorna `400 Bad Request` se `dataDe` for posterior a `dataAte`.

A API **não fornece um total de horas agregado**. O resumo (por exemplo, `7h30`) precisa ser calculado pela interface somando `horaFim - horaInicio` para os intervalos devolvidos, agrupados por data. Não usar os números do wireframe como dados fixos.

**`POST /api/disponibilidades-estudo`** também existe para criar um intervalo, com body `{ data, horaInicio, horaFim }`. Retorna `201 Created`, `400 Bad Request` para campos/horários inválidos e `409 Conflict` quando o intervalo se sobrepõe a uma disponibilidade existente. Neste momento não há endpoint de atualização ou exclusão de disponibilidade.

O protótipo não define um formulário de gerenciamento de disponibilidade. Se a tela inicial precisar ser autossuficiente quando não houver nenhum horário cadastrado, será necessário aprovar uma pequena interface de cadastro usando o `POST` existente ou definir outra forma de preparar dados para a primeira demonstração.

### 3.5 Sessões existentes

**`GET /api/sessoes-estudo?dataDe=yyyy-MM-dd&dataAte=yyyy-MM-dd&situacao=...`**\
Controller: `SessoesEstudoController.Listar`. Todos os filtros são opcionais. Retorna `200 OK` e uma lista de `SessaoEstudoResponse`, ordenada por data, hora e ID.

Outros endpoints de sessões existentes incluem `POST /api/sessoes-estudo`, `PUT /api/sessoes-estudo/{id}` e ações para iniciar, concluir, cancelar e excluir conforme as regras de situação; criação retorna `201`, validações podem retornar `400` e conflitos de situação/sobreposição podem retornar `409`.

Para a primeira tela de planejamento, não é necessário carregar sessões para recalcular horários no front-end: `GET /previa` já considera sessões ativas no servidor e `POST /confirmar` devolve as sessões criadas. O `GET /api/sessoes-estudo` pode ser usado posteriormente para uma visualização de calendário ou para confirmar o estado após uma falha de rede ambígua, sem ampliar agora o escopo para gerenciamento de sessões.

### 3.6 Tarefas vinculadas a demandas

`GET /api/demandas-academicas/{demandaId}/tarefas` lista tarefas de uma demanda específica. As respostas da tarefa contêm `id`, `demandaAcademicaId`, `titulo`, `descricao`, `ordem`, `esforcoEstimadoMinutos` e `situacao`.

A prévia pode alocar uma tarefa como unidade de estudo: nesses casos, `titulo` representa a atividade e `tarefaDemandaId` a identifica; a resposta não garante que o `demandaAcademicaId` esteja preenchido para a alocação de tarefa (os testes atuais cobrem esse caso). Não presumir que toda alocação corresponde diretamente a um cartão da lista de demandas.

### 3.7 Enumerações no JSON

`Program.cs` registra `AddControllers()` sem configurar globalmente `JsonStringEnumConverter`. Os enums devem ser tratados como valores numéricos no contrato JSON atual, a menos que a configuração local revele alguma personalização adicional. No mapeamento presente nos modelos:

- `tipo`: `0 Prova`, `1 Trabalho`, `2 APG`, `3 TCC`, `4 Outro`.
- `importancia`: `0 Baixa`, `1 Media`, `2 Alta`.
- `situacao` de demanda: `0 Pendente`, `1 EmAndamento`, `2 Concluida`, `3 Cancelada`.
- `situacao` de sessão: `0 Planejada`, `1 EmAndamento`, `2 Concluida`, `3 Cancelada`.
- `motivo` de não alocação: `0 EstimativaAusente`, `1 EstimativaInvalida`, `2 SemDisponibilidadeNaSemana`, `3 DuracaoMaiorQueQualquerDisponibilidade`, `4 HorarioOcupadoPorSessaoExistente`, `5 CapacidadeConsumidaPorAtividadesPrioritarias`.

Criar funções explícitas de apresentação para traduzir esses códigos em rótulos amigáveis. Não depender da conversão de `PascalCase` em texto de tela.

## 4. Mapeamento da tela para a API

### 4.1 Estado inicial: “Revisão da semana”

Ao abrir a página, usar a segunda-feira da semana selecionada como referência e carregar, em paralelo:

1. `GET /api/demandas-academicas/priorizadas` para o painel **Prioridades acadêmicas**;
2. `GET /api/disponibilidades-estudo?dataDe={segunda}&dataAte={domingo}` para resumo de disponibilidade e horários por dia.

Não chamar a prévia automaticamente na montagem da tela: o Figma solicita que a pessoa revise os dados e clique em **Gerar prévia**. O estado inicial não deve conter sessões inventadas nem os exemplos estáticos do wireframe.

O painel de disponibilidade soma os intervalos do retorno; a lista de demandas mostra tipo, prazo, importância e estimativa, sempre tratando campos opcionais. Como `DemandaAcademicaResponse` não contém nome/ID de disciplina, não preencher uma disciplina fictícia.

**Estado vazio:** se o endpoint retornar `[]`, mostrar uma explicação específica para demandas ou disponibilidade ausente. Não chamar isso de falha. Ações para cadastrar dados exigem uma decisão de escopo; ver seção 8.

**Falha parcial:** se somente demandas ou disponibilidades falhar, preservar o painel que carregou e mostrar erro/repetição no painel que falhou. Um erro de uma chamada não deve apagar dados obtidos com sucesso pela outra.

### 4.2 Ao escolher outra semana

- Validar no front-end que a data representa uma segunda-feira e enviá-la em `yyyy-MM-dd`.
- Buscar novamente as disponibilidades para o período selecionado.
- Invalidar uma prévia existente quando a semana muda. A prévia está associada a uma semana e aos dados usados no seu cálculo.
- Não inventar uma regra de proibição de semanas passadas nesta etapa; o backend exige segunda-feira, mas não bloqueia explicitamente toda semana passada. A política para semanas passadas precisa ser decidida antes da finalização da UX.

### 4.3 Gerar prévia

Ao clicar em **Gerar prévia**:

1. desabilitar temporariamente o botão e mostrar estado de carregamento;
2. chamar `GET /api/planejamento-semanal/previa?inicioSemana={yyyy-MM-dd}`;
3. no sucesso, guardar a resposta inteira em memória, incluindo `propostaId`, `agora`, `alocacoes` e `naoAlocadas`;
4. apresentar o estado **Prévia não salva**, o total sugerido (soma de `duracaoPlanejadaMinutos`), os cartões de sessão, os itens não alocados e os motivos/descrições devolvidos pela API;
5. manter visível que nada será gravado até a pessoa confirmar.

O total de horas alocadas deve ser calculado a partir das alocações retornadas, não copiado do total de disponibilidade. Os dois números têm significados diferentes.

Se `alocacoes` estiver vazio, apresentar o resultado válido com suas razões em `naoAlocadas`. A política para exibir/habilitar **Confirmar planejamento** com zero alocações está em aberto e precisa de aprovação; a API pode aceitar uma lista vazia, mas a UX deve evitar uma confirmação sem efeito que surpreenda a pessoa.

### 4.4 Prévia exibida

Fonte para a lista **Seu plano da semana**: `alocacoes` da resposta de prévia. Fonte para a lista **Atividades não alocadas**: `naoAlocadas` da mesma resposta. Não tentar executar o algoritmo de prioridade/alocação no front-end.

Exibir:

- título (`titulo`), data (`dataPlanejada`), hora inicial (`horaInicio`) e duração (`duracaoPlanejadaMinutos`);
- vínculo de demanda/tarefa quando houver ID disponível e quando a UI tiver informação real suficiente;
- o motivo e a `descricao` para cada item não alocado, com um rótulo visual legível para `motivo`;
- estado **Prévia não salva** e texto equivalente a “A prévia só é salva ao confirmar”.

**Diferenças protótipo/contrato para resolver:**

- O wireframe inclui uma segunda linha de “foco”/disciplina (por exemplo, “Revisão de integrais · Cálculo II”), mas `AlocacaoPlanejamentoResponse` só contém `titulo`, IDs, data, hora e duração. Para a primeira versão, remover/ocultar a linha de foco ou mostrar somente informação realmente disponível. Adicionar um novo campo à API exigiria uma decisão separada.
- O wireframe chama uma demanda de “Disciplina”, mas o modelo/DTO de demanda expõe `tipo`, não uma disciplina associada. Mostrar tipo e demais campos existentes sem inventar associação.
- A lista priorizada lista demandas-pai, enquanto o planejador pode alocar tarefas. Uma alocação baseada em tarefa pode ter `tarefaDemandaId` e `demandaAcademicaId = null`; não pressupor que os dados dos cartões da lista inicial bastem para expandir toda alocação em nome de sua demanda-pai.
- O wireframe tem exemplos fixos de datas, horários e títulos. Na aplicação, todos esses dados devem vir dos endpoints ou de estado realmente selecionado.

O MVP não deve permitir editar manualmente as alocações dentro da prévia: a decisão de domínio registrada em `docs/adr/001-planejamento-semanal-mvp.md` é revisar e confirmar/descartar a proposta, sem editar as alocações antes da confirmação. Ajustar essa decisão exige aprovação explícita.

### 4.5 Confirmar planejamento

Ao clicar em **Confirmar planejamento**:

1. enviar `POST /api/planejamento-semanal/confirmar` usando apenas `inicioSemana`, `agora`, `propostaId` e `alocacoes` guardados da resposta de prévia;
2. não regenerar `propostaId`, alterar as alocações, reenviar `naoAlocadas` ou recalcular os horários no cliente;
3. mostrar indicador de envio e evitar duplo clique;
4. em `200 OK`, mostrar confirmação e usar `sessoesCriadas` como evidência das sessões persistidas;
5. em `409 Conflict`, explicar o `title`/`detail` retornado, descartar a proposta como confirmável e oferecer **Gerar nova prévia**. Não repetir automaticamente a mesma confirmação;
6. em `400 Bad Request`, mostrar mensagem apropriada e permitir que a pessoa retome o fluxo; preservar o detalhe útil do problema sem exibir stack trace;
7. em falha de rede/`5xx`, informar que não foi possível verificar o resultado e permitir recuperação. Não afirmar que não houve gravação se a conexão falhou depois do envio.

Depois da confirmação, atualizar o status para **Planejamento confirmado**. Se a pessoa continuar nesta página, usar os dados de `sessoesCriadas`; uma nova prévia só deve ser gerada mediante ação explícita.

## 5. Componentes e estados de interface

Componentes sugeridos como divisão de responsabilidades, não como escolha de biblioteca:

- **App shell**: navegação lateral e área de conteúdo.
- **Cabeçalho de planejamento**: título, descrição, semana selecionada e status do fluxo.
- **Seletor da semana**: seleciona uma semana com início na segunda-feira.
- **Resumo de disponibilidade**: horas totais e blocos agrupados por dia, calculados do endpoint.
- **Lista de prioridades** e **Cartão de demanda**: representa os itens retornados por `priorizadas`.
- **Botão de ação**: “Gerar prévia” ou “Confirmar planejamento”, de acordo com o estado.
- **Cartão de sessão proposta**: representação de um `AlocacaoPlanejamentoResponse`.
- **Lista de atividades não alocadas**: rótulo e descrição por motivo.
- **Feedback acessível**: alertas de erro, sucesso, aviso de conflito, loading, vazio e botão de tentar novamente.

Estados do fluxo:

`Inicial/carregando dados` → `Revisão da semana` → `Gerando prévia` → `Prévia exibida` → `Confirmando` → `Planejamento confirmado`.

Ramificações recuperáveis:

- erro ao carregar demandas ou disponibilidade → erro localizado com repetição;
- sem dados → estado vazio distinto de erro;
- erro ao gerar prévia (`400`, rede ou `5xx`) → manter a tela e permitir corrigir a semana/repetir;
- conflito ao confirmar (`409`) → avisar e pedir nova prévia;
- erro ao confirmar (`400`/rede/`5xx`) → preservar contexto para recuperação, sem afirmar sucesso;
- trocar a semana ou recarregar dados de base depois de a prévia ser gerada → invalidar a prévia anterior.

## 6. Ordem incremental de implementação

### Etapa 0 — Conferência e decisões de base

- Confirmar branch, `git status` e commits locais; conferir se os controllers/DTOs locais correspondem ao commit-base.
- Decidir a stack de front-end (proposta a considerar: React + Vite, sem compromisso antes da aprovação) e como a interface alcançará a API em desenvolvimento/produção.
- Resolver os pontos bloqueadores da seção 8 antes de criar estrutura ou instalar dependências.

**Saída:** plano revisado, escopo da primeira fatia aprovado e nenhuma alteração de código ainda.

### Etapa 1 — Esqueleto visual e carregamento inicial

- Criar somente o app front-end aprovado e a composição de layout baseada no Figma.
- Implementar navegação, cabeçalho, seletor de semana, resumo de disponibilidade e lista priorizada.
- Conectar os dois GETs e mostrar estados de carregamento, vazio, erro e nova tentativa.
- Usar dados reais; não inserir exemplos fixos no código da aplicação.

**Saída verificável:** página inicial carrega demandas/disponibilidade e continua compreensível quando qualquer endpoint retorna lista vazia ou falha.

### Etapa 2 — Geração e apresentação da prévia

- Conectar o botão ao `GET /api/planejamento-semanal/previa`.
- Guardar a proposta retornada e renderizar as alocações e motivos de não alocação.
- Exibir claramente que a prévia ainda não está salva.
- Cobrir resposta sem alocações, sem itens não alocados e ausência de disponibilidade.

**Saída verificável:** a tela reflete o payload do backend sem cálculos de alocação locais e não cria sessões.

### Etapa 3 — Confirmação e conflitos

- Ligar o botão à `POST /api/planejamento-semanal/confirmar`, enviando somente os campos do contrato.
- Tratar `200`, `400`, `409`, falha de rede e `5xx`.
- Em `409`, invalidar o payload antigo e disponibilizar geração de uma prévia nova.
- Prevenir envio duplicado enquanto a confirmação estiver em andamento.

**Saída verificável:** proposta válida é confirmada; proposta stale ou conflitante gera recuperação clara, sem repetição automática do payload antigo.

### Etapa 4 — Testes, responsividade e revisão visual

- Criar testes de UI/API simulada para os estados principais e falhas.
- Validar o contrato de integração com a API real em ambiente de desenvolvimento seguro.
- Ajustar layout para desktop, tablet e celular antes de considerar a interface finalizada.
- Comparar o render com o Figma, respeitando o contrato real onde o wireframe contém dados que a API ainda não fornece.
- Rodar testes e build existentes antes de sugerir commit. Inspecionar `git status` e stage apenas os arquivos desta fatia.

**Saída verificável:** critérios de conclusão da seção 7 satisfeitos; mudanças mantidas isoladas e sem incluir a etapa seguinte no mesmo commit.

## 7. Critérios de conclusão e testes

A primeira versão da interface será considerada concluída quando:

1. O front-end carrega demandas priorizadas e disponibilidade da semana pelos endpoints corretos.
2. A soma de horas disponíveis e a soma das durações alocadas são calculadas a partir de dados recebidos, e não são confundidas.
3. A semana enviada tem formato `yyyy-MM-dd` e segunda-feira como início.
4. A prévia exibe todas as alocações recebidas e todas as atividades não alocadas com seu motivo/descrição.
5. A prévia não é persistida antes da confirmação e o rótulo de estado deixa isso explícito.
6. A confirmação reenvia os valores relevantes da proposta original sem os recalcular ou modificar.
7. Uma confirmação válida mostra as sessões devolvidas pela API.
8. Um `409 Conflict` resulta em mensagem compreensível e ação de gerar nova prévia; o mesmo payload não é reenviado automaticamente.
9. Erros de rede/servidor, `400`, listas vazias e carregamentos têm estados visíveis e distintos.
10. Campos opcionais e enums são renderizados com rótulos amigáveis; a interface não pressupõe disciplina ou foco ausentes do contrato.
11. Não há dados de exemplo mascarados como dados reais, nem requisições ou mutações de banco remoto.
12. O layout funciona em desktop, tablet e celular; teclado, foco e mensagens de estado são utilizáveis.
13. Testes de interface cobrem carregamento, dados vazios, falha de cada chamada inicial, prévia sem alocação, motivos de não alocação, confirmação bem-sucedida, `400`, `409`, falha de rede e prevenção de duplo clique.
14. Build e testes relevantes passam antes do commit, e `git status` confirma que apenas arquivos da fatia foram incluídos.

## 8. Decisões ainda pendentes de aprovação

1. **Stack:** a interface desta fatia está implementada em React + Vite. Uma eventual mudança de stack deve depender de uma necessidade validada.
2. **Navegação lateral:** substituir `Concursos e editais` por `Disciplinas` ou `Planos de estudo` na navegação inicial, ou ocultar essa entrada no MVP. A decisão é apenas de interface e não remove endpoints/recursos atuais.
3. **Disciplina/foco no wireframe:** para o MVP, aceitar que cartões mostrem tipo e título disponíveis, removendo a linha de disciplina/foco que a API não fornece? Alternativa: abrir uma tarefa separada de evolução de contrato, fora desta primeira fatia.
4. **Sem dados cadastrados:** o painel já permite cadastrar demandas. Ainda falta decidir se a interface deve oferecer cadastro de disponibilidades; a API permite `POST`, mas a disponibilidade não tem endpoints de edição/exclusão.
5. **Semana passada:** permitir visualizar prévias de semanas anteriores ou restringir o seletor a semana atual/futura? O contrato atual valida segunda-feira, mas não declara uma proibição geral de semana passada.
6. **Prévia sem alocações:** esconder/desabilitar confirmação quando a lista `alocacoes` estiver vazia, ou permitir a confirmação vazia explicitamente? A API pode aceitar a lista vazia; a decisão aqui é de UX.
7. **Integração/hosting:** a interface ainda não foi integrada ao histórico normal do Git nem ao CI do frontend. O proxy do Vite resolve o acesso à API no desenvolvimento local; definir a hospedagem e a estratégia de integração para produção permanece pendente.
8. **Folga do planejamento:** o exemplo do Figma usa toda a disponibilidade de 7h30. Não alterar o algoritmo ou adicionar margens agora. Primeiro observar resultados reais e depois decidir se a margem/flexibilidade deve ser regra de domínio.

## 9. Fora do escopo desta etapa

- Introduzir outra stack ou instalar dependências sem necessidade validada.
- Alterar `PlanejadorSemanal`, sua regra first-fit, prioridades ou constraints PostgreSQL.
- Criar endpoints, campos ou DTOs fictícios para satisfazer o wireframe.
- Introduzir autenticação, autorização, `UsuarioId` ou migrações de ownership nesta primeira fatia. A autenticação permanece necessária antes de abrir o produto a múltiplos usuários/publicação, mas não precisa bloquear o protótipo local.
- Criar banco paralelo para prévias, salvar a proposta ao gerar ou permitir editar alocações antes da confirmação.
- Adicionar geração de resumos, questões, flashcards, IA ou gamificação sem evidência de necessidade.
- Alterar banco remoto, executar migrations remotas, reverter migrations irreversíveis, fazer push/merge ou modificar histórico Git.

## 10. Arquivos de referência consultados

**Controllers:**

- `src/CadernoAtlas.Api/Controllers/PlanejamentoSemanalController.cs`
- `src/CadernoAtlas.Api/Controllers/DemandasAcademicasController.cs`
- `src/CadernoAtlas.Api/Controllers/DisponibilidadesEstudoController.cs`
- `src/CadernoAtlas.Api/Controllers/SessoesEstudoController.cs`
- `src/CadernoAtlas.Api/Controllers/TarefasDemandaController.cs`

**Contracts e modelos:**

- `src/CadernoAtlas.Api/Contracts/PlanejamentoSemanal/PreviaPlanejamentoSemanalRequest.cs`
- `src/CadernoAtlas.Api/Contracts/PlanejamentoSemanal/ConfirmarPlanejamentoSemanalRequest.cs`
- `src/CadernoAtlas.Api/Contracts/PlanejamentoSemanal/PlanejamentoSemanalResponse.cs`
- `src/CadernoAtlas.Api/Contracts/PlanejamentoSemanal/ConfirmarPlanejamentoSemanalResponse.cs`
- `src/CadernoAtlas.Api/Contracts/DemandasAcademicas/` (criação, atualização e respostas)
- `src/CadernoAtlas.Api/Contracts/DisponibilidadesEstudo/`
- `src/CadernoAtlas.Api/Contracts/SessoesEstudo/`
- `src/CadernoAtlas.Api/Models/TipoDemandaAcademica.cs`
- `src/CadernoAtlas.Api/Models/ImportanciaDemandaAcademica.cs`
- `src/CadernoAtlas.Api/Models/SituacaoDemandaAcademica.cs`
- `src/CadernoAtlas.Api/Models/SituacaoSessaoEstudo.cs`
- `src/CadernoAtlas.Api/Program.cs`

**Serviços, regras e testes:**

- `src/CadernoAtlas.Api/Services/PlanejadorSemanal.cs`
- `src/CadernoAtlas.Api/Services/PriorizadorDemandasAcademicas.cs`
- `src/CadernoAtlas.Api/Services/PlanejamentoSemanalDadosFingerprintService.cs`
- `src/CadernoAtlas.Api/Services/PlanejamentoSemanalPropostaIdService.cs`
- `tests/CadernoAtlas.Api.Tests/PlanejamentoSemanalEndpointTests.cs`
- `tests/CadernoAtlas.Api.Tests/DemandasAcademicasTests.cs`
- `tests/CadernoAtlas.Api.Tests/DisponibilidadesEstudoTests.cs`
- `tests/CadernoAtlas.Api.Tests/SessoesEstudoTests.cs`
- `tests/CadernoAtlas.Api.Tests/PostgreSqlSessoesEstudoTests.cs`
- `docs/adr/001-planejamento-semanal-mvp.md`

---

**Próximos passos propostos:** completar os cenários de teste pendentes da seção 7, revisar responsividade e acessibilidade em navegador e decidir a integração dos arquivos da interface ao Git e ao CI do frontend. Definir também uma estratégia de hospedagem antes de publicar a aplicação.
