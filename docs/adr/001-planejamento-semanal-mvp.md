# ADR 001 - Planejamento semanal determinístico (MVP)

## Contexto

O CadernoAtlas já possui demandas acadêmicas, tarefas vinculadas a demandas, disponibilidades de estudo e sessões de estudo. O planejamento semanal deve aproveitar esses conceitos existentes, sem criar uma segunda entidade para representar sessões planejadas.

O MVP deve produzir uma proposta previsível, explicável e revisável pelo estudante. Deve alocar o máximo de atividades possível sem inventar disponibilidade, duplicar uma demanda com suas tarefas ou gravar uma proposta parcialmente válida.

## Decisões

### D1. Planejador determinístico e estratégia first-fit

O planejador será uma lógica de aplicação determinística. Dadas as mesmas demandas, tarefas, disponibilidades, sessões existentes, início de semana e instante de referência, deve produzir o mesmo resultado.

As atividades serão ordenadas conforme a regra de prioridade descrita na seção **Ordenação de atividades**. Para cada atividade, o algoritmo percorre os intervalos livres em ordem cronológica e usa o primeiro intervalo contínuo que comporte toda a duração estimada. Não divide uma atividade entre intervalos e não arredonda sua duração para blocos fixos.

A duração é expressa em minutos inteiros e deve ser maior que zero. Não haverá duração mínima artificial no MVP. Uma atividade que não caiba em nenhum intervalo fica não alocada; as demais continuam sendo processadas. A implementação atual valida estimativas informadas como maiores que zero nos contratos HTTP de demandas e tarefas, além de manter a distinção para dados legados no planejador.

Intervalos de disponibilidade sobrepostos ou consecutivos no mesmo dia serão normalizados como uma união de intervalos antes da alocação, para que a mesma capacidade horária não seja contada duas vezes e para que uma tarefa possa ocupar um período contínuo formado por disponibilidades consecutivas.

### D2. Referência temporal explícita e testável

O planejador não chamará `DateTime.Now`, `DateTime.UtcNow` ou equivalentes internamente.

A API HTTP recebe apenas `InicioSemana` na prévia implementada. O controller obtém o instante atual por `TimeProvider` e constrói o comando interno `PlanejarSemanaRequest`, que contém `InicioSemana` e `Agora` (`DateTimeOffset`). Assim, `Agora` é preenchido pelo servidor, não aceito como campo de entrada controlado pelo cliente na criação da prévia.

Em execução real, o relógio será `TimeProvider.System`. Testes passarão um instante fixo. O planejador converterá esse instante para o fuso horário configurado da aplicação, cujo valor padrão é `America/Sao_Paulo`, para determinar a data local e o limite a partir do qual ainda é possível alocar sessões.

`InicioSemana` deve ser uma segunda-feira no calendário de `America/Sao_Paulo`. Qualquer outra data será rejeitada com `400 Bad Request`; a API não ajustará silenciosamente a data enviada. A semana é o intervalo de segunda-feira às 00:00 até a segunda-feira seguinte às 00:00, com início inclusivo e final exclusivo. Disponibilidades da semana seguinte não entram no resultado.

Na semana corrente, o início de um intervalo livre será limitado ao próximo minuto completo que não seja anterior ao instante local atual. Por exemplo, se `Agora` for 09:17:30, o primeiro início permitido será 09:18; se for exatamente 09:17:00, será 09:17. O planejador não proporá sessões que comecem no passado. A confirmação também verificará se as alocações continuam no futuro.

### D3. Elegibilidade e unidade de planejamento

Somente demandas com situação `Pendente` ou `EmAndamento` são consideradas. Demandas `Concluida` ou `Cancelada` e suas tarefas não geram atividades planejáveis.

A unidade de planejamento será determinada assim:

- Demanda sem tarefas vinculadas: a própria demanda é uma atividade e usa `EsforcoEstimadoMinutos` da demanda.
- Demanda com uma ou mais tarefas vinculadas: a demanda-pai não é planejada separadamente; são consideradas apenas suas tarefas com situação `Pendente` ou `EmAndamento`.
- Tarefas `Concluida` são ignoradas. O modelo atual de tarefa não tem situação `Cancelada`; essa situação não será inventada como parte desta alteração.
- Se todas as tarefas de uma demanda ainda ativa estiverem concluídas, a demanda-pai não volta a ser planejada automaticamente. A atualização automática da situação da demanda permanece fora do escopo.

Uma demanda com tarefas não será contabilizada também como atividade, mesmo que tenha esforço estimado, para impedir dupla contagem. As sessões confirmadas serão vinculadas ao `TarefaId` para atividades que representam tarefas e ao `DemandaId` para atividades que representam demandas sem tarefas, respeitando a regra de vínculo exclusivo já existente na entidade `SessaoEstudo`.

`EsforcoEstimadoMinutos` foi adicionado como campo opcional à tarefa, com validação coerente com o requisito de planejamento (valor informado maior que zero). A validação do esforço da demanda também não aceita zero. Esforço ausente e esforço inválido continuam distintos no resultado para proteger o planejador contra dados legados.

### D4. Ordenação de atividades

O algoritmo reutilizará a classificação de urgência de `PriorizadorDemandasAcademicas`, usando a data local derivada de `Agora` como referência. Não será introduzido um segundo sistema independente de prioridade.

A ordenação das demandas segue, nesta ordem:

1. Faixa de urgência: atrasada; vence hoje; até 3 dias; até 7 dias; até 14 dias; prazo distante; sem prazo definido.
2. Prazo ascendente; prazos nulos ficam por último.
3. Importância decrescente: alta, média, baixa.
4. Situação: `EmAndamento` antes de `Pendente`.
5. Título em ordem alfabética sem diferenciar maiúsculas e minúsculas.
6. `DemandaId` crescente.

Quando uma demanda é representada por tarefas, suas tarefas herdam a posição de prioridade da demanda-pai. Dentro da mesma demanda, as tarefas são ordenadas por `Ordem` crescente e, para desempate, por `TarefaId` crescente. A ordenação não depende da ordem em que os registros forem retornados pelo banco.

### D5. Alocação e intervalos livres

Para o cálculo de intervalos livres, o planejador considerará o estado das sessões existentes:

- Sessões com situação `Planejada` e `EmAndamento`: reservam horário e têm seus intervalos descontados das disponibilidades de estudo.
- Sessões com situação `Concluida` e `Cancelada`: não reservam horário e não bloqueiam a agenda.
- Sessões propostas pelo próprio algoritmo também consomem os intervalos livres durante a execução da prévia, impedindo que múltiplas atividades recebam o mesmo horário.

As sessões não podem exceder o intervalo de disponibilidade usado para alocá-las. Todos os intervalos serão tratados como períodos locais de calendário, expressos por data e hora local. Os intervalos serão semiabertos `[início, fim)`: duas sessões em que a primeira termina exatamente quando a segunda começa são consecutivas, não sobrepostas.

Além da ocupação de horário, aplica-se a regra de prevenção de duplicidade de atividade: uma demanda ou tarefa que já possua sessão em situação `Planejada` ou `EmAndamento`, vinculada à mesma atividade, não deve ser proposta novamente como uma nova alocação. Essa regra trata da duplicidade da atividade e estabelece que:
- A sessão ativa (`Planejada` ou `EmAndamento`) já representa o agendamento daquela atividade no calendário.
- A atividade não deve receber uma segunda alocação na prévia.
- Concluir uma sessão não conclui automaticamente a tarefa ou a demanda vinculada; a elegibilidade de novas alocações continua dependendo da situação da própria tarefa ou demanda, segundo as regras de D3.

Uma tarefa de 45 minutos pode ocupar uma janela de 60 minutos, usando os primeiros 45 minutos. Uma tarefa de 70 minutos não cabe em uma janela de 60 minutos, mas poderá ocupar uma janela posterior de 90 minutos. O intervalo anterior de 60 minutos continuará disponível para atividades menores. Não haverá divisão automática de tarefas longas.

### D6. Resultado completo com motivos fechados

Cada atividade elegível deve constar no resultado como alocada ou não alocada. Nenhuma atividade poderá desaparecer silenciosamente. O planejamento sobrecarregado não falhará por inteiro: alocará o que couber e explicará o que ficou de fora.

Os códigos de motivo de não alocação do MVP serão:

- `EstimativaAusente`: a atividade não tem duração estimada.
- `EstimativaInvalida`: a duração estimada é zero ou negativa, inclusive em registros legados.
- `SemDisponibilidadeNaSemana`: não há disponibilidade válida na semana solicitada.
- `DuracaoMaiorQueQualquerDisponibilidade`: existe disponibilidade, mas nenhum intervalo contínuo original comporta a duração completa da atividade.
- `HorarioOcupadoPorSessaoExistente`: havia uma janela de disponibilidade suficientemente longa, mas sessões já existentes a dividiram ou ocuparam de modo que não restou um intervalo contínuo suficiente.
- `CapacidadeConsumidaPorAtividadesPrioritarias`: havia um intervalo livre suficientemente longo depois de descontar sessões existentes, mas atividades de prioridade maior foram alocadas nele antes da atividade atual.

A classificação do motivo será feita de modo determinístico, avaliando disponibilidade original, disponibilidade após descontar sessões existentes e disponibilidade restante após as alocações da própria prévia, nessa ordem. Valores de esforço inválidos também devem ser rejeitados na validação das entradas de criação/atualização relevantes; o código `EstimativaInvalida` protege o planejador contra dados inválidos ou legados.

### D7. Integridade global de não sobreposição no PostgreSQL

Como o modelo atual não possui `estudante_id` nem outro identificador de proprietário de calendário, a constraint será **global para toda a aplicação**: a constraint deve impedir a sobreposição entre períodos de sessões com situação `Planejada` e `EmAndamento`, independentemente da demanda ou tarefa a que estejam vinculadas. Sessões `Concluida` e `Cancelada` devem ficar fora da constraint. Esta é uma decisão consciente para o modelo atual e deve ser reavaliada quando houver calendário por usuário.

A garantia definitiva foi implementada no PostgreSQL por uma constraint de exclusão GiST que detecta sobreposição (`&&`) sobre um intervalo calculado a partir de `DataPlanejada`, `HoraInicioPlanejada` e `DuracaoPlanejadaMinutos`, usando limites `[início, fim)`. A constraint incide apenas sobre sessões ativas (`Planejada` e `EmAndamento`), deixando sessões com situação `Concluida` e `Cancelada` fora da constraint (por meio de predicado suportado pelo PostgreSQL em exclusion constraints). A expressão real está registrada na migration `20261017182658_ImpedirSobreposicaoSessoesAtivas`; não é presumida uma coluna `Periodo` inexistente.

A validação da API é usada para retornar uma mensagem de conflito compreensível, mas não substitui a constraint do banco. Conforme confirmação recebida, a migration foi aplicada ao banco local `cadernoatlas` via script SQL. A confirmação do planejamento grava todas as sessões em uma única transação serializável. Se a constraint ou outra validação detectar conflito, a transação inteira é revertida, sem gravação parcial. SQLite não é substituto suficiente para validar esse comportamento específico.

### D8. Prévia stateless e confirmação integral

A prévia não será persistida no banco e não exigirá uma tabela `PreviaPlanejamento`. A API devolverá a proposta completa, incluindo semana, instante de referência, alocações e itens não alocados. O cliente enviará essa proposta de volta para confirmação.

A consulta da prévia será `GET /api/planejamento-semanal/previa?inicioSemana=yyyy-MM-dd`. Como a operação somente lê os dados atuais e calcula uma resposta sem persistir a proposta, `GET` mantém a semântica de consulta. A entrada HTTP contém somente `InicioSemana`; `Agora` é obtido pelo servidor por meio de `TimeProvider`.

A confirmação não confiará cegamente no payload recebido. O servidor carregará novamente as demandas, tarefas, disponibilidades e sessões, recalculará a proposta a partir dos dados enviados e do `Agora` original da prévia, e verificará que as alocações recebidas correspondem à proposta determinística recalculada. Também verificará, usando o instante atual real, que nenhuma sessão proposta começou ou passou a estar no passado.

Se a disponibilidade ou os registros relevantes tiverem mudado, a proposta enviada divergir do resultado recalculado ou algum horário deixar de ser válido, a API recusará a confirmação inteira com `409 Conflict`, sem persistir sessões, e solicitará uma nova prévia. Se estiver válida, gravará todas as sessões propostas na mesma transação. A constraint global de não sobreposição do PostgreSQL permanece como última linha de defesa contra concorrência.

O estudante poderá confirmar ou descartar a proposta. Edição das alocações ainda na prévia fica fora do MVP; depois da confirmação, as sessões seguem os endpoints existentes de gerenciamento de `SessaoEstudo`. O contrato implementado preserva essa separação sem expor `Agora` como campo de entrada livre na criação da prévia.

### D9. Testes e validação

O contrato é coberto por testes automatizados. Os testes do algoritmo usam dados e relógio fixos, sem depender da data real do computador.

A suíte deve cobrir explicitamente:
- Limites da semana e fuso horário;
- Elegibilidade sem dupla contagem entre demanda e tarefas;
- Não duplicidade: atividade que já possui sessão ativa vinculada (`Planejada` ou `EmAndamento`) não é proposta novamente;
- Independência de conclusão: concluir uma sessão, por si só, não conclui a demanda ou tarefa; a elegibilidade continua dependendo da situação da própria tarefa ou demanda;
- Todos os critérios de prioridade e desempate;
- Intervalos menores, iguais e maiores que a duração estimada;
- Normalização de disponibilidades consecutivas e sobrepostas;
- Limite de horários passados e corte a partir de `Agora`;
- Alocação e bloqueio de horários por sessões existentes:
  - Sessão `Planejada` bloqueia o horário ocupado;
  - Sessão `EmAndamento` bloqueia o horário ocupado;
  - Sessão `Concluida` não bloqueia o horário;
  - Sessão `Cancelada` não bloqueia o horário;
- Intervalos consecutivos permitidos sem conflito;
- Todos os códigos de não alocação da lista fechada;
- Sobrecarga e capacidade consumida por atividades prioritárias;
- Rejeição de sobreposição pela API e pelo banco;
- Prévia sem persistência;
- Confirmação integral e verificação de que sessões propostas permanecem no futuro;
- Conflito entre prévia e confirmação gerando recusa total;
- Rollback integral em caso de conflito no banco;
- Constraint de exclusão do PostgreSQL: respeita as mesmas situações (impede sobreposição apenas entre sessões `Planejada` e `EmAndamento`, deixando `Concluida` e `Cancelada` fora) e permite intervalos consecutivos `[início, fim)`.

Os testes existentes que usam SQLite continuam cobrindo regras gerais sem regressões. Os testes com SQLite não devem ser apresentados como substitutos do teste da constraint. A constraint de exclusão tem testes de integração na categoria PostgreSQL; a execução local informada em 18/10/2026 observou 11 testes aprovados, sem falhas ou testes ignorados. O workflow atual provisiona PostgreSQL 16 e banco dedicado para os testes; conforme resultado de CI informado para 18/10/2026, a execução terminou com sucesso ([workflow run 39132920598](https://github.com/Joaoptoaldo/CadernoAtlas/actions/runs/39132920598)). Continua pendente a reprodução de uma falha real de serialização `40001` no endpoint de confirmação.

## Estado de implementação e verificação

- A prévia `GET /api/planejamento-semanal/previa` está implementada com leitura de demandas, tarefas, disponibilidades e sessões ativas, cálculo first-fit e resposta sem persistência.
- A confirmação `POST /api/planejamento-semanal/confirmar` está implementada com revalidação do fingerprint, assinatura HMAC, transação serializável, persistência atômica e tratamento controlado dos códigos `23P01` e `40001`.
- Conforme confirmação recebida, a migration `20261017182658_ImpedirSobreposicaoSessoesAtivas` foi aplicada ao banco local `cadernoatlas` via script SQL. O tratamento de `40001` está implementado, mas não há evidência de reprodução de uma falha real de serialização concorrente no endpoint de confirmação.
- A fixture PostgreSQL chama `MigrateAsync()` no banco informado pela variável exclusiva e rejeita nomes que não terminem em `_test`; use o banco dedicado `cadernoatlas_test`. O workflow provisiona PostgreSQL para essa suíte, e, conforme resultado informado para 18/10/2026, a execução terminou com sucesso ([workflow run 39132920598](https://github.com/Joaoptoaldo/CadernoAtlas/actions/runs/39132920598)). Ainda não há reprodução específica de `40001` durante a confirmação do planejamento.

## Critérios de aceitação

- **CA-1 — Semana:** o planejador aceita somente um `InicioSemana` que seja segunda-feira local. A semana considera `[segunda 00:00, segunda seguinte 00:00)` e nenhuma disponibilidade fora desse intervalo entra no resultado.
- **CA-2 — Hora atual:** dado um `Agora` fixo, o corte para novas alocações é o próximo minuto completo que não seja anterior ao instante local de referência. Em testes, o resultado independe do relógio real.
- **CA-3 — Elegibilidade e não duplicidade:** uma demanda sem tarefas gera no máximo uma atividade; uma demanda com tarefas gera somente atividades para suas tarefas ativas; demandas concluídas ou canceladas e tarefas concluídas não são alocadas. Uma demanda ou tarefa que já possua sessão ativa (`Planejada` ou `EmAndamento`) vinculada não é proposta novamente na prévia. Concluir uma sessão, por si só, não conclui a demanda ou tarefa vinculada.
- **CA-4 — Prioridade:** para entradas idênticas, o planejador produz a mesma ordem conforme todos os critérios e desempates descritos em D4.
- **CA-5 — First-fit:** cada atividade é alocada inteira no primeiro intervalo contínuo livre cronologicamente que a comporta, sem arredondamento, divisão ou consumo de intervalos insuficientes.
- **CA-6 — Não alocadas:** toda atividade elegível que não for alocada aparece uma vez, com um código de motivo da lista fechada em D6.
- **CA-7 — Não sobreposição:** sessões `Planejada` e `EmAndamento` com períodos sobrepostos devem ser recusadas pela API e pelo PostgreSQL; sessões consecutivas devem ser permitidas; sessões `Concluida` e `Cancelada` não reservam horário nem participam da constraint.
- **CA-8 — Prévia:** gerar uma prévia não grava sessões nem outras alterações no banco.
- **CA-9 — Confirmação:** uma proposta válida grava todas as sessões em uma única transação; proposta stale, divergente ou conflitante é rejeitada integralmente, sem gravação parcial.
- **CA-10 — Compatibilidade:** demandas, tarefas, disponibilidades e sessões existentes continuam funcionando; a alteração reutiliza `SessaoEstudo` em vez de criar uma tabela paralela de sessões planejadas.
- **CA-11 — PostgreSQL real:** os testes de integração da constraint de exclusão existem; a execução local informada em 18/10/2026 observou 11 aprovados, 0 falhas e 0 ignorados. O workflow provisiona PostgreSQL 16 e, conforme resultado de CI informado para a mesma data, a execução terminou com sucesso ([workflow run 39132920598](https://github.com/Joaoptoaldo/CadernoAtlas/actions/runs/39132920598)). Use o banco dedicado `cadernoatlas_test`. Ainda não há reprodução específica de uma falha real de serialização `40001` no endpoint de confirmação.

## Consequências

### Positivas

- Os resultados são previsíveis e reproduzíveis em testes.
- O estudante recebe uma proposta compreensível e mantém a decisão final.
- A aplicação aloca o que é possível, sem ocultar tarefas que ficaram de fora.
- A integridade de horários não depende somente de validação na API.
- A prévia stateless evita persistir propostas abandonadas e evita uma tabela de prévias no MVP.

### Custos e limitações aceitos

- Tarefas longas não são divididas automaticamente.
- Sem um identificador de calendário/estudante, a constraint impede sobreposição global, mesmo quando futuramente usuários distintos poderiam ter agendas independentes.
- A confirmação stateless exige payload de proposta e revalidação/recomputação no servidor; mudanças relevantes invalidam a prévia.
- A regra de esforço positivo exige alinhar validações existentes e adicionar esforço estimado às tarefas.
- A constraint específica exige teste contra PostgreSQL, além da suíte atual com SQLite.

## Fora do escopo do MVP

- Dividir automaticamente atividades longas em várias sessões.
- Duração mínima de sessão ou arredondamento para blocos fixos.
- Compromissos pessoais independentes das disponibilidades de estudo.
- Calendários separados por usuário ou `estudante_id`.
- Editar alocações na prévia antes da confirmação.
- Atualizar automaticamente a situação da demanda quando as tarefas forem concluídas.
- Planejamento ótimo global, pontuação complexa ou algoritmo baseado em IA.
- Persistir histórico de prévias abandonadas.

## Referências

- [PostgreSQL — Range Types e exclusion constraints](https://www.postgresql.org/docs/17/rangetypes.html)
- [Microsoft Learn — TimeProvider](https://learn.microsoft.com/dotnet/standard/datetime/timeprovider-overview)
