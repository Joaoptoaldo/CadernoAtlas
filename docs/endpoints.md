# Documentação dos Endpoints da API — CadernoAtlas

Este documento descreve detalhadamente todos os endpoints HTTP implementados na API do **CadernoAtlas**, com suas respectivas rotas, parâmetros, exemplos de requisição e resposta, códigos de status e regras de negócio.

---

## Sumário

1. [Convenções Gerais](#convenções-gerais)
2. [Demandas Acadêmicas](#1-demandas-acadêmicas)
3. [Tarefas de Demandas Acadêmicas](#2-tarefas-de-demandas-acadêmicas)
4. [Sessões de Estudo](#3-sessões-de-estudo)
5. [Concursos Públicos](#4-concursos-públicos)
6. [Disciplinas do Edital](#5-disciplinas-do-edital)
7. [Tópicos e Subtópicos do Edital](#6-tópicos-e-subtópicos-do-edital)
8. [Cadernos de Estudo](#7-cadernos-de-estudo)
9. [Endpoints de Desenvolvimento e Suporte](#8-endpoints-de-desenvolvimento-e-suporte)

---

## Convenções Gerais

- **Formato de Dados:** Todas as requisições e respostas utilizam `application/json`.
- **Datas:**
  - Campos do tipo `DateOnly` utilizam o formato `yyyy-MM-dd` (ex.: `"2026-11-10"`).
  - Campos de carimbo temporal (`DateTime`) são retornados em formato ISO 8601 UTC (ex.: `"2026-10-16T15:00:00Z"`).
- **Serialização de Enums:** Os valores de enums são serializados como texto (`string`).
- **Respostas de Erro:** Falhas de validação de modelo e regras de negócio retornam objetos com o padrão `ProblemDetails` do ASP.NET Core (RFC 7807), incluindo campos como `title`, `detail`, `status` e `errors`.

---

## 1. Demandas Acadêmicas

Representa compromissos e entregas acadêmicas (provas, trabalhos, atividades de APG, TCC). Centraliza prazos, nível de importância e estimativa de esforço.

### Rotas

| Método | Caminho | Finalidade |
|---|---|---|
| `GET` | `/api/demandas-academicas` | Listar demandas acadêmicas com suporte a filtros combináveis. |
| `GET` | `/api/demandas-academicas/priorizadas` | Listar demandas ativas ordenadas por urgência, prazo e importância, com justificativas legíveis. |
| `GET` | `/api/demandas-academicas/{id}` | Obter detalhes de uma demanda específica pelo identificador. |
| `POST` | `/api/demandas-academicas` | Criar uma nova demanda acadêmica. |
| `PUT` | `/api/demandas-academicas/{id}` | Atualizar dados e situação de uma demanda existente. |

> **Nota de integridade:** O recurso de demandas acadêmicas **não** disponibiliza endpoint `DELETE`. Para preservar o histórico acadêmico do estudante, demandas canceladas ou descontinuadas devem ter sua situação alterada para `Cancelada`.

### Parâmetros de Consulta (`GET /api/demandas-academicas`)

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `situacao` | `string` | Não | Filtra por situação: `Pendente`, `EmAndamento`, `Concluida` ou `Cancelada`. |
| `tipo` | `string` | Não | Filtra por tipo: `Prova`, `Trabalho`, `APG`, `TCC` ou `Outro`. |
| `importancia` | `string` | Não | Filtra por importância: `Baixa`, `Media` ou `Alta`. |
| `prazoAte` | `string` | Não | Limite máximo de prazo no formato estrito `yyyy-MM-dd`. Retorna `400 Bad Request` se a data for inválida. |

### Regras de Negócio
- **Conclusão de Demanda:** Uma demanda não pode ser atualizada para `Concluida` se ainda possuir tarefas vinculadas com situação `Pendente` ou `EmAndamento`. Caso tente, a API retorna `400 Bad Request`.
- **Esforço Estimado:** Quando informado, deve ser um número inteiro maior ou igual a zero (minutos).
- **Priorização Determinística (`/priorizadas`):**
  - Considera apenas demandas em situação `Pendente` ou `EmAndamento`.
  - A data de referência ("hoje") é calculada convertendo o instante atual UTC para o fuso horário configurado na aplicação (`America/Sao_Paulo` por padrão).
  - Ordenação multicritério:
    1. Faixa de urgência: `Atrasada` (0) > `Vence hoje` (1) > `Até 3 dias` (2) > `Até 7 dias` (3) > `Até 14 dias` (4) > `Prazo distante` (5) > `Sem prazo definido` (6);
    2. Prazo mais próximo (`Prazo` ascendente; valores nulos ao final);
    3. Importância decrescente (`Alta` > `Media` > `Baixa`);
    4. Situação (`EmAndamento` tem precedência sobre `Pendente`);
    5. Título alfabético e `Id` para desempate estável.
  - Retorna o cálculo de `diasAtePrazo`, a `faixaUrgencia` e uma `justificativa` explicável em linguagem natural.

### Exemplos

#### Criar Demanda (`POST /api/demandas-academicas`)

**Requisição:**
```json
{
  "titulo": "Entrega do Relatório de Estágio",
  "descricao": "Elaborar o relatório final e colher assinaturas da coordenação",
  "tipo": "Trabalho",
  "prazo": "2026-11-10",
  "importancia": "Alta",
  "esforcoEstimadoMinutos": 180
}
```

**Resposta (`201 Created`):**
```json
{
  "id": 1,
  "titulo": "Entrega do Relatório de Estágio",
  "descricao": "Elaborar o relatório final e colher assinaturas da coordenação",
  "tipo": "Trabalho",
  "prazo": "2026-11-10",
  "importancia": "Alta",
  "esforcoEstimadoMinutos": 180,
  "situacao": "Pendente",
  "criadoEm": "2026-10-16T15:00:00Z"
}
```

#### Listar Priorizadas (`GET /api/demandas-academicas/priorizadas`)

**Resposta (`200 OK`):**
```json
[
  {
    "demanda": {
      "id": 1,
      "titulo": "Entrega do Relatório de Estágio",
      "descricao": "Elaborar o relatório final e colher assinaturas da coordenação",
      "tipo": "Trabalho",
      "prazo": "2026-10-18",
      "importancia": "Alta",
      "esforcoEstimadoMinutos": 180,
      "situacao": "Pendente",
      "criadoEm": "2026-10-16T15:00:00Z"
    },
    "faixaUrgencia": "Até 3 dias",
    "diasAtePrazo": 2,
    "justificativa": "Prazo em 2 dias; importância alta; situação pendente."
  }
]
```

### Códigos de Retorno
- `200 OK`: Consulta ou atualização realizada com sucesso.
- `201 Created`: Demanda cadastrada com sucesso (com cabeçalho `Location`).
- `400 Bad Request`: Parâmetro de data inválido, falha de validação de modelo (ex.: título com menos de 2 caracteres) ou tentativa de concluir demanda com tarefas em aberto.
- `404 NotFound`: Demanda não encontrada pelo `id`.

---

## 2. Tarefas de Demandas Acadêmicas

Tarefas representam etapas menores e executáveis necessárias para o cumprimento de uma demanda acadêmica.

### Rotas

| Método | Caminho | Finalidade |
|---|---|---|
| `GET` | `/api/demandas-academicas/{demandaId}/tarefas` | Listar tarefas de uma demanda, ordenadas por `Ordem` e `Id`. |
| `GET` | `/api/demandas-academicas/{demandaId}/tarefas/{tarefaId}` | Obter uma tarefa específica de uma demanda. |
| `POST` | `/api/demandas-academicas/{demandaId}/tarefas` | Criar uma nova tarefa vinculada à demanda. |
| `PUT` | `/api/demandas-academicas/{demandaId}/tarefas/{tarefaId}` | Atualizar dados, ordem e situação de uma tarefa. |
| `DELETE` | `/api/demandas-academicas/{demandaId}/tarefas/{tarefaId}` | Excluir uma tarefa vinculada à demanda. |

### Regras de Negócio
- **Demanda Concluída Bloqueada:** Não é permitido adicionar novas tarefas em uma demanda cuja situação seja `Concluida` (`409 Conflict`).
- **Bloqueio de Reabertura:** Não é permitido alterar a situação de uma tarefa para `Pendente` ou `EmAndamento` caso a demanda pai esteja `Concluida` (`409 Conflict`). A demanda deve ser reaberta primeiro.
- **Sequenciamento Automático:** Ao criar uma tarefa, o sistema calcula automaticamente o campo `Ordem` como o próximo valor incremental disponível (`ultimaOrdem + 1`).
- **Valores de Situação:** `Pendente`, `EmAndamento`, `Concluida`.

### Exemplos

#### Criar Tarefa (`POST /api/demandas-academicas/1/tarefas`)

**Requisição:**
```json
{
  "titulo": "Revisar introdução e objetivos",
  "descricao": "Adequar às normas ABNT"
}
```

**Resposta (`201 Created`):**
```json
{
  "id": 1,
  "demandaAcademicaId": 1,
  "titulo": "Revisar introdução e objetivos",
  "descricao": "Adequar às normas ABNT",
  "ordem": 0,
  "situacao": "Pendente"
}
```

#### Atualizar Tarefa (`PUT /api/demandas-academicas/1/tarefas/1`)

**Requisição:**
```json
{
  "titulo": "Revisar introdução e objetivos",
  "descricao": "Adequar às normas ABNT",
  "ordem": 0,
  "situacao": "Concluida"
}
```

**Resposta (`200 OK`):** Retorna o objeto `TarefaDemandaResponse` atualizado.

### Códigos de Retorno
- `200 OK`: Consulta ou atualização bem-sucedida.
- `201 Created`: Tarefa criada com sucesso.
- `204 NoContent`: Tarefa excluída com sucesso.
- `400 Bad Request`: Dados inválidos (ex.: título menor que 2 caracteres ou situação inválida).
- `404 NotFound`: Demanda pai ou tarefa não encontrada.
- `409 Conflict`: Operação rejeitada porque a demanda pai está com situação `Concluida`.

---

## 3. Sessões de Estudo

Representa blocos dedicados de estudo planejados e executados pelo estudante. Permite organizar horários previstos de dedicação, acompanhar a execução em tempo real, calcular o tempo efetivo de estudo e associar a atividade ao contexto de uma demanda acadêmica ou a uma tarefa específica.

### Rotas

| Método | Caminho | Finalidade |
|---|---|---|
| `GET` | `/api/sessoes-estudo` | Listar todas as sessões de estudo cadastradas, ordenadas cronologicamente por `DataPlanejada`, `HoraInicioPlanejada` e `Id`. |
| `GET` | `/api/sessoes-estudo/{id}` | Obter detalhes de uma sessão de estudo específica pelo identificador. |
| `POST` | `/api/sessoes-estudo` | Criar uma nova sessão de estudo com situação inicial `Planejada`. |
| `PUT` | `/api/sessoes-estudo/{id}` | Atualizar dados de uma sessão de estudo existente (permitido apenas na situação `Planejada`). |
| `POST` | `/api/sessoes-estudo/{id}/iniciar` | Iniciar a sessão de estudo, alterando a situação para `EmAndamento` e registrando o instante real de início. |
| `POST` | `/api/sessoes-estudo/{id}/concluir` | Concluir uma sessão em andamento, registrando o instante de conclusão e calculando a duração real em minutos. |
| `POST` | `/api/sessoes-estudo/{id}/cancelar` | Cancelar uma sessão planejada ou em andamento, registrando o encerramento e calculando o tempo decorrido caso tenha sido iniciada. |
| `DELETE` | `/api/sessoes-estudo/{id}` | Excluir uma sessão de estudo (permitido apenas para sessões na situação `Planejada`). |

### Estados e Ciclo de Vida (`SituacaoSessaoEstudo`)

As sessões de estudo possuem um ciclo de vida estrito com quatro estados possíveis:

1. **`Planejada`** (`0`): Estado inicial atribuído na criação. A sessão possui data, horário de início e duração prevista, mas ainda não foi iniciada. Pode ser editada, iniciada, cancelada ou excluída fisicamente.
2. **`EmAndamento`** (`1`): Sessão ativada pelo endpoint `/iniciar`. O campo `inicioRealEm` é preenchido com o carimbo temporal UTC atual. Sessões em andamento não podem ser editadas nem excluídas; apenas concluídas ou canceladas.
3. **`Concluida`** (`2`): Sessão finalizada com sucesso pelo endpoint `/concluir`. O campo `concluidaEm` é registrado e a `duracaoRealMinutos` é calculada automaticamente com base no tempo decorrido. Fica bloqueada para qualquer alteração, cancelamento ou exclusão, preservando o histórico de estudo.
4. **`Cancelada`** (`3`): Sessão interrompida ou descontinuada pelo endpoint `/cancelar`. O campo `canceladaEm` é registrado. Se a sessão já estava `EmAndamento`, a `duracaoRealMinutos` transcorrida até o cancelamento é calculada e persistida. Fica bloqueada contra edições, reinício ou exclusão.

### Campos do DTO

#### Criação e Atualização (`CriarSessaoEstudoRequest` / `AtualizarSessaoEstudoRequest`)

| Campo | Tipo | Obrigatório | Restrições e Validações |
|---|---|---|---|
| `titulo` | `string` | Sim | Mínimo de 2 e máximo de 150 caracteres. Espaços no início e fim são removidos automaticamente. |
| `dataPlanejada` | `DateOnly` | Sim | Data planejada para a sessão no formato `yyyy-MM-dd`. |
| `horaInicioPlanejada` | `TimeOnly` | Sim | Horário previsto para início no formato `HH:mm` ou `HH:mm:ss`. |
| `duracaoPlanejadaMinutos` | `int` | Sim | Duração estimada em minutos. Faixa válida: entre `1` e `1440` minutos (1 dia). |
| `demandaAcademicaId` | `int?` | Não | Identificador de demanda acadêmica existente (`>= 1`). Mutuamente exclusivo com `tarefaDemandaId`. |
| `tarefaDemandaId` | `int?` | Não | Identificador de tarefa de demanda existente (`>= 1`). Mutuamente exclusivo com `demandaAcademicaId`. |
| `observacoes` | `string?` | Não | Anotações complementares. Máximo de 1000 caracteres. Textos em branco são convertidos para `null`. |

#### Resposta (`SessaoEstudoResponse`)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `int` | Identificador único da sessão de estudo. |
| `titulo` | `string` | Título da sessão de estudo. |
| `dataPlanejada` | `DateOnly` | Data planejada da sessão (`yyyy-MM-dd`). |
| `horaInicioPlanejada` | `TimeOnly` | Horário planejado de início (`HH:mm:ss`). |
| `duracaoPlanejadaMinutos` | `int` | Duração planejada em minutos. |
| `duracaoRealMinutos` | `int?` | Duração real apurada em minutos (`null` enquanto planejada; calculada após conclusão ou cancelamento de sessão iniciada). |
| `situacao` | `number` (`SituacaoSessaoEstudo`) | Situação atual no JSON (representação numérica do enum): `0` (`Planejada`), `1` (`EmAndamento`), `2` (`Concluida`) ou `3` (`Cancelada`). |
| `demandaAcademicaId` | `int?` | Identificador da demanda acadêmica vinculada (`null` se avulsa ou vinculada a tarefa). |
| `tarefaDemandaId` | `int?` | Identificador da tarefa vinculada (`null` se avulsa ou vinculada a demanda). |
| `observacoes` | `string?` | Observações da sessão. |
| `criadoEm` | `DateTime` | Carimbo temporal UTC de criação do registro. |
| `inicioRealEm` | `DateTime?` | Carimbo temporal UTC do momento em que a sessão foi iniciada. |
| `concluidaEm` | `DateTime?` | Carimbo temporal UTC do momento de conclusão da sessão. |
| `canceladaEm` | `DateTime?` | Carimbo temporal UTC do momento em que a sessão foi cancelada. |

### Regras de Negócio e Validações

- **Exclusividade e Opcionalidade de Vínculos:**
  - Uma sessão de estudo pode ser avulsa (sem vínculos), estar vinculada diretamente a uma **demanda acadêmica**, ou a uma **tarefa de demanda**.
  - Não é permitido informar simultaneamente `demandaAcademicaId` e `tarefaDemandaId`. A violação é rejeitada com `400 Bad Request` tanto na validação do payload (`IValidatableObject`) quanto no banco de dados (`CHECK constraint`: `CK_SessoesEstudo_VinculoUnico`).
- **Validação de Existência dos Vínculos:**
  - Caso `demandaAcademicaId` seja informado, a API valida se a demanda existe no banco de dados. Caso não exista, retorna `400 Bad Request` (`"A demanda acadêmica informada não existe."`).
  - Caso `tarefaDemandaId` seja informado, a API valida se a tarefa existe no banco de dados. Caso não exista, retorna `400 Bad Request` (`"A tarefa informada não existe."`).
- **Integridade Referencial na Exclusão de Demandas ou Tarefas:**
  - As chaves estrangeiras com `DemandasAcademicas` e `TarefasDemanda` utilizam `OnDelete(DeleteBehavior.SetNull)` (`ReferentialAction.SetNull`). Se uma demanda ou tarefa vinculada for excluída, o vínculo na sessão de estudo correspondente torna-se nulo sem descartar o registro da sessão de estudo.
- **Edição Restrita a Sessões Planejadas:**
  - O endpoint `PUT /api/sessoes-estudo/{id}` só permite alterar sessões na situação `Planejada`. Tentativas de editar sessões em andamento, concluídas ou canceladas retornam `409 Conflict`.
- **Início de Sessão:**
  - Somente sessões na situação `Planejada` podem ser iniciadas (`POST /api/sessoes-estudo/{id}/iniciar`). Tentar iniciar uma sessão que já esteja em andamento, concluída ou cancelada retorna `409 Conflict`.
- **Conclusão de Sessão e Apuração de Duração:**
  - Somente sessões com situação `EmAndamento` e com `inicioRealEm` registrado podem ser concluídas (`POST /api/sessoes-estudo/{id}/concluir`). O endpoint retorna `409 Conflict` se a sessão estiver planejada, já concluída ou cancelada.
  - A duração real em minutos é calculada pela diferença inteira arredondada para baixo entre o término e o início: `Math.Max(0, (int)Math.Floor((fim - inicio).TotalMinutes))`.
- **Cancelamento e Preservação de Tempo Parcial:**
  - Sessões `Planejada` ou `EmAndamento` podem ser canceladas (`POST /api/sessoes-estudo/{id}/cancelar`). Tentar cancelar uma sessão já concluída ou cancelada retorna `409 Conflict`.
  - Se a sessão cancelada estava `EmAndamento`, a API calcula e persiste o tempo decorrido até o instante do cancelamento em `duracaoRealMinutos`. Se estava `Planejada`, a duração real permanece `null`.
- **Preservação de Histórico e Bloqueio de Exclusão:**
  - O endpoint `DELETE /api/sessoes-estudo/{id}` só permite excluir sessões com situação `Planejada`.
  - Sessões que já foram iniciadas (`EmAndamento`), concluídas ou canceladas não podem ser excluídas fisicamente, retornando `409 Conflict` (`"Somente sessões planejadas podem ser excluídas. Registros de sessões iniciadas devem ser preservados."`).
- **Estrutura no Banco de Dados (Migration `20261016233244_AdicionarSessoesEstudo`):**
  - Tabela `SessoesEstudo`.
  - Check constraints: `CK_SessoesEstudo_DuracaoPlanejadaPositiva` (`"DuracaoPlanejadaMinutos" > 0`), `CK_SessoesEstudo_DuracaoRealNaoNegativa` (`"DuracaoRealMinutos" IS NULL OR "DuracaoRealMinutos" >= 0`) e `CK_SessoesEstudo_VinculoUnico` (`"DemandaAcademicaId" IS NULL OR "TarefaDemandaId" IS NULL`).
  - Índices: `IX_SessoesEstudo_DataPlanejada_HoraInicioPlanejada` (composto), `IX_SessoesEstudo_DemandaAcademicaId` e `IX_SessoesEstudo_TarefaDemandaId`.

### Exemplos

#### Criar Sessão de Estudo Vinculada a uma Demanda (`POST /api/sessoes-estudo`)

**Requisição:**
```json
{
  "titulo": "Revisar normalização de bancos de dados",
  "dataPlanejada": "2026-11-10",
  "horaInicioPlanejada": "14:00",
  "duracaoPlanejadaMinutos": 60,
  "demandaAcademicaId": 1,
  "tarefaDemandaId": null,
  "observacoes": "Revisar as três primeiras formas normais (1FN, 2FN, 3FN)"
}
```

**Resposta (`201 Created`):**
```json
{
  "id": 1,
  "titulo": "Revisar normalização de bancos de dados",
  "dataPlanejada": "2026-11-10",
  "horaInicioPlanejada": "14:00:00",
  "duracaoPlanejadaMinutos": 60,
  "duracaoRealMinutos": null,
  "situacao": 0,
  "demandaAcademicaId": 1,
  "tarefaDemandaId": null,
  "observacoes": "Revisar as três primeiras formas normais (1FN, 2FN, 3FN)",
  "criadoEm": "2026-10-16T23:30:00Z",
  "inicioRealEm": null,
  "concluidaEm": null,
  "canceladaEm": null
}
```

#### Iniciar Sessão de Estudo (`POST /api/sessoes-estudo/1/iniciar`)

**Resposta (`200 OK`):**
```json
{
  "id": 1,
  "titulo": "Revisar normalização de bancos de dados",
  "dataPlanejada": "2026-11-10",
  "horaInicioPlanejada": "14:00:00",
  "duracaoPlanejadaMinutos": 60,
  "duracaoRealMinutos": null,
  "situacao": 1,
  "demandaAcademicaId": 1,
  "tarefaDemandaId": null,
  "observacoes": "Revisar as três primeiras formas normais (1FN, 2FN, 3FN)",
  "criadoEm": "2026-10-16T23:30:00Z",
  "inicioRealEm": "2026-11-10T14:02:15Z",
  "concluidaEm": null,
  "canceladaEm": null
}
```

#### Concluir Sessão de Estudo (`POST /api/sessoes-estudo/1/concluir`)

**Resposta (`200 OK`):**
```json
{
  "id": 1,
  "titulo": "Revisar normalização de bancos de dados",
  "dataPlanejada": "2026-11-10",
  "horaInicioPlanejada": "14:00:00",
  "duracaoPlanejadaMinutos": 60,
  "duracaoRealMinutos": 58,
  "situacao": 2,
  "demandaAcademicaId": 1,
  "tarefaDemandaId": null,
  "observacoes": "Revisar as três primeiras formas normais (1FN, 2FN, 3FN)",
  "criadoEm": "2026-10-16T23:30:00Z",
  "inicioRealEm": "2026-11-10T14:02:15Z",
  "concluidaEm": "2026-11-10T15:00:45Z",
  "canceladaEm": null
}
```

#### Cancelar Sessão de Estudo (`POST /api/sessoes-estudo/1/cancelar`)

**Resposta (`200 OK`):**
```json
{
  "id": 1,
  "titulo": "Revisar normalização de bancos de dados",
  "dataPlanejada": "2026-11-10",
  "horaInicioPlanejada": "14:00:00",
  "duracaoPlanejadaMinutos": 60,
  "duracaoRealMinutos": 25,
  "situacao": 3,
  "demandaAcademicaId": 1,
  "tarefaDemandaId": null,
  "observacoes": "Revisar as três primeiras formas normais (1FN, 2FN, 3FN)",
  "criadoEm": "2026-10-16T23:30:00Z",
  "inicioRealEm": "2026-11-10T14:02:15Z",
  "concluidaEm": null,
  "canceladaEm": "2026-11-10T14:27:15Z"
}
```

### Códigos de Retorno
- `200 OK`: Consulta, atualização, início, conclusão ou cancelamento bem-sucedido.
- `201 Created`: Sessão cadastrada com sucesso (inclui cabeçalho `Location`).
- `204 NoContent`: Sessão planejada excluída com sucesso.
- `400 Bad Request`: Dados inválidos (título com menos de 2 caracteres, duração fora da faixa 1-1440, preenchimento simultâneo de demanda e tarefa, ou vínculo referenciando registro inexistente).
- `404 NotFound`: Sessão de estudo não encontrada pelo `id`.
- `409 Conflict`: Violação de ciclo de vida (tentativa de editar ou excluir sessão que não está `Planejada`, tentativa de iniciar sessão não `Planejada`, tentativa de concluir sessão que não está `EmAndamento`, ou cancelamento de sessão já finalizada).

---

## 4. Concursos Públicos

Gerenciamento de editais de concursos públicos para estruturação de estudos.

### Rotas

| Método | Caminho | Finalidade |
|---|---|---|
| `GET` | `/api/concursos` | Listar todos os concursos cadastrados, ordenados por nome. |
| `GET` | `/api/concursos/{id}` | Obter detalhes de um concurso pelo identificador. |
| `POST` | `/api/concursos` | Cadastrar um novo concurso. |
| `PUT` | `/api/concursos/{id}` | Atualizar dados de um concurso existente. |
| `DELETE` | `/api/concursos/{id}` | Excluir um concurso e, em cascata, suas disciplinas e tópicos vinculados. |

### Campos do DTO

- `nome` (`string`, obrigatório, 2 a 150 caracteres)
- `orgao` (`string`, obrigatório, 2 a 150 caracteres)
- `banca` (`string`, opcional, até 100 caracteres)
- `numeroEdital` (`string`, opcional, até 50 caracteres)
- `dataPublicacao` (`DateOnly`, opcional, formato `yyyy-MM-dd`)
- `dataProva` (`DateOnly`, opcional, formato `yyyy-MM-dd`)

### Exemplo de Criação (`POST /api/concursos`)

**Requisição:**
```json
{
  "nome": "Auditor Fiscal da Receita Federal",
  "orgao": "Receita Federal do Brasil",
  "banca": "FGV",
  "numeroEdital": "01/2026",
  "dataPublicacao": "2026-06-01",
  "dataProva": "2026-12-15"
}
```

**Resposta (`201 Created`):**
```json
{
  "id": 1,
  "nome": "Auditor Fiscal da Receita Federal",
  "orgao": "Receita Federal do Brasil",
  "banca": "FGV",
  "numeroEdital": "01/2026",
  "dataPublicacao": "2026-06-01",
  "dataProva": "2026-12-15",
  "criadoEm": "2026-10-14T18:00:00Z"
}
```

### Códigos de Retorno
- `200 OK`: Sucesso na consulta ou atualização.
- `201 Created`: Concurso cadastrado com sucesso.
- `204 NoContent`: Concurso excluído com sucesso.
- `400 Bad Request`: Dados obrigatórios ausentes ou limites de texto excedidos.
- `404 NotFound`: Concurso não encontrado pelo `id`.

---

## 5. Disciplinas do Edital

Gerenciamento das matérias e disciplinas vinculadas a um concurso público.

### Rotas

| Método | Caminho | Finalidade |
|---|---|---|
| `GET` | `/api/concursos/{concursoId}/disciplinas` | Listar disciplinas do concurso, ordenadas por `Ordem` e `Nome`. |
| `GET` | `/api/concursos/{concursoId}/disciplinas/{id}` | Obter uma disciplina específica do concurso. |
| `POST` | `/api/concursos/{concursoId}/disciplinas` | Cadastrar uma nova disciplina vinculada ao concurso. |
| `PUT` | `/api/concursos/{concursoId}/disciplinas/{id}` | Atualizar nome e ordem da disciplina. |
| `DELETE` | `/api/concursos/{concursoId}/disciplinas/{id}` | Excluir a disciplina e seus tópicos associados. |

### Campos do DTO

- `nome` (`string`, obrigatório, 2 a 120 caracteres)
- `ordem` (`int`, obrigatório, posição numérica na grade de disciplinas)

### Códigos de Retorno
- `200 OK`: Sucesso na consulta ou atualização.
- `201 Created`: Disciplina criada com sucesso.
- `204 NoContent`: Disciplina excluída com sucesso.
- `400 Bad Request`: Nome inválido ou ausente.
- `404 NotFound`: Concurso pai ou disciplina não encontrados.

---

## 6. Tópicos e Subtópicos do Edital

Permite estruturar a árvore de conteúdos programáticos de uma disciplina, suportando tópicos principais e subtópicos aninhados.

### Rotas

| Método | Caminho | Finalidade |
|---|---|---|
| `GET` | `/api/concursos/{concursoId}/disciplinas/{disciplinaId}/topicos` | Listar tópicos da disciplina, ordenados por `TopicoPaiId`, `Ordem` e `Descricao`. |
| `GET` | `/api/concursos/{concursoId}/disciplinas/{disciplinaId}/topicos/{id}` | Obter um tópico específico pelo identificador. |
| `POST` | `/api/concursos/{concursoId}/disciplinas/{disciplinaId}/topicos` | Cadastrar um novo tópico ou subtópico. |
| `PUT` | `/api/concursos/{concursoId}/disciplinas/{disciplinaId}/topicos/{id}` | Atualizar descrição, ordem, tópico pai ou status de estudo. |
| `DELETE` | `/api/concursos/{concursoId}/disciplinas/{disciplinaId}/topicos/{id}` | Excluir o tópico (exclusão em cascata de subtópicos). |

### Regras de Negócio e Validações
- **Prevenção de Ciclos:** Ao definir ou atualizar `topicoPaiId`, a API valida toda a cadeia ancestral para impedir referências circulares (um tópico não pode ser ancestral de si mesmo). Caso forme um ciclo, retorna `400 Bad Request`.
- **Mesma Disciplina:** O `topicoPaiId` deve pertencer obrigatoriamente à mesma disciplina do tópico filho.
- **Valores do Enum `Status`:**
  - `Pendente` (padrão)
  - `Estudando`
  - `Estudado`
  - `Revisar`

### Exemplo de Criação (`POST /api/concursos/1/disciplinas/2/topicos`)

**Requisição:**
```json
{
  "descricao": "Controle de Constitucionalidade",
  "ordem": 1,
  "topicoPaiId": null,
  "status": "Pendente"
}
```

**Resposta (`201 Created`):**
```json
{
  "id": 10,
  "disciplinaEditalId": 2,
  "topicoPaiId": null,
  "descricao": "Controle de Constitucionalidade",
  "ordem": 1,
  "status": "Pendente"
}
```

### Códigos de Retorno
- `200 OK`: Sucesso na consulta ou alteração.
- `201 Created`: Tópico cadastrado com sucesso.
- `204 NoContent`: Tópico excluído com sucesso.
- `400 Bad Request`: Formação de ciclos na árvore, tópico pai em disciplina diferente ou descrição menor que 2 caracteres.
- `404 NotFound`: Concurso, disciplina ou tópico não encontrado.

---

## 7. Cadernos de Estudo

Gerenciamento de cadernos temáticos para registro de anotações e consolidação de estudos.

### Rotas

| Método | Caminho | Finalidade |
|---|---|---|
| `GET` | `/api/cadernos` | Listar todos os cadernos de estudo, ordenados por título. |
| `GET` | `/api/cadernos/{id}` | Obter detalhes de um caderno de estudo. |
| `POST` | `/api/cadernos` | Cadastrar um novo caderno. |
| `PUT` | `/api/cadernos/{id}` | Atualizar título e descrição de um caderno. |
| `DELETE` | `/api/cadernos/{id}` | Excluir um caderno de estudo. |

### Campos do DTO

- `titulo` (`string`, obrigatório, 2 a 150 caracteres)
- `descricao` (`string`, opcional, até 1000 caracteres)

### Exemplo de Criação (`POST /api/cadernos`)

**Requisição:**
```json
{
  "titulo": "Direito Administrativo - Atos e Poderes",
  "descricao": "Resumos e jurisprudência dos tribunais superiores"
}
```

**Resposta (`201 Created`):**
```json
{
  "id": 1,
  "titulo": "Direito Administrativo - Atos e Poderes",
  "descricao": "Resumos e jurisprudência dos tribunais superiores",
  "criadoEm": "2026-10-14T21:50:00Z"
}
```

### Códigos de Retorno
- `200 OK`: Consulta ou atualização bem-sucedida.
- `201 Created`: Caderno criado com sucesso.
- `204 NoContent`: Caderno excluído com sucesso.
- `400 Bad Request`: Título ausente ou fora dos limites de caracteres.
- `404 NotFound`: Caderno não encontrado pelo `id`.

---

## 8. Endpoints de Desenvolvimento e Suporte

Endpoints utilitários disponíveis no pipeline da aplicação:

| Método | Caminho | Ambiente | Finalidade |
|---|---|---|---|
| `GET` | `/_dev/database-check` | `Development` | Verifica a conectividade com o banco PostgreSQL. Retorna `200 OK` (`{"status":"ok","database":"connected"}`) ou `503 Service Unavailable`. |
| `GET` | `/openapi/v1.json` | `Development` | Especificação OpenAPI 3.0 gerada dinamicamente pelo ASP.NET Core. |
| `GET` | `/WeatherForecast` | Todos | Endpoint modelo gerado no scaffolding inicial do projeto. |
