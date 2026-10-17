# ADR 001 - Planejamento semanal determinístico (MVP)

## Contexto

O CadernoAtlas já possui demandas acadêmicas, tarefas vinculadas a demandas, disponibilidades de estudo e sessões de estudo. O planejamento semanal deve aproveitar esses conceitos existentes, sem criar uma segunda entidade para representar sessões planejadas.

O MVP deve produzir uma proposta previsível, explicável e revisável pelo estudante. Deve alocar o máximo de atividades possível sem inventar disponibilidade, duplicar uma demanda com suas tarefas ou gravar uma proposta parcialmente válida.

## Decisões

### D1. Planejador determinístico e estratégia first-fit

O planejador será uma lógica de aplicação determinística. Dadas as mesmas demandas, tarefas, disponibilidades, sessões existentes, início de semana e instante de referência, deve produzir o mesmo resultado.

As atividades serão ordenadas conforme a regra de prioridade descrita na seção **Ordenação de atividades**. Para cada atividade, o algoritmo percorre os intervalos livres em ordem cronológica e usa o primeiro intervalo contínuo que comporte toda a duração estimada. Não divide uma atividade entre intervalos e não arredonda sua duração para blocos fixos.

A duração é expressa em minutos inteiros e deve ser maior que zero. Não haverá duração mínima artificial no MVP. Uma atividade que não caiba em nenhum intervalo fica não alocada; as demais continuam sendo processadas.

Intervalos de disponibilidade sobrepostos ou consecutivos no mesmo dia serão normalizados como uma união de intervalos antes da alocação, para que a mesma capacidade horária não seja contada duas vezes e para que uma tarefa possa ocupar um período contínuo formado por disponibilidades consecutivas.

### D2. Referência temporal explícita e testável

O planejador não chamará `DateTime.Now`, `DateTime.UtcNow` ou equivalentes internamente.

A API HTTP receberá apenas `InicioSemana`. O controller obterá o instante atual por `TimeProvider` e construirá o comando interno `PlanejarSemanaRequest`, que conterá `InicioSemana` e `Agora` (`DateTimeOffset`). Assim, `Agora` é preenchido pelo servidor, não aceito como campo de entrada controlado pelo cliente na criação da prévia.

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

A implementação deverá adicionar `EsforcoEstimadoMinutos` opcional à tarefa, com validação coerente com o requisito de planejamento (valor informado maior que zero). A validação do esforço da demanda deverá ser alinhada para não aceitar zero como estimativa planejável. Esforço ausente e esforço inválido serão distinguidos no resultado.

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

O planejador descontará das disponibilidades todas as sessões existentes cuja situação seja diferente de `Cancelada`, bem como as sessões que já propôs durante a execução do próprio algoritmo. As sessões não podem exceder o intervalo de disponibilidade usado para alocá-las.

Todos os intervalos serão tratados como períodos locais de calendário, expressos por data e hora local. Os intervalos serão semiabertos `[início, fim)`: duas sessões em que a primeira termina exatamente quando a segunda começa são consecutivas, não sobrepostas.

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

Como o modelo atual não possui `estudante_id` nem outro identificador de proprietário de calendário, a constraint será **global para toda a aplicação**: duas sessões não canceladas não podem ter períodos planejados sobrepostos, independentemente da demanda ou tarefa a que estejam vinculadas. Esta é uma decisão consciente para o modelo atual e deve ser reavaliada quando houver calendário por usuário.

A garantia definitiva será aplicada no PostgreSQL por uma constraint de exclusão GiST que detecta sobreposição (`&&`) sobre um intervalo calculado a partir de `DataPlanejada`, `HoraInicioPlanejada` e `DuracaoPlanejadaMinutos`, usando limites `[início, fim)`. A constraint excluirá sessões com situação `Cancelada`. A forma exata da expressão e a migration deverão ser verificadas no modelo real antes de aplicar; não será presumida uma coluna `Periodo` inexistente.

A validação da API continuará sendo usada para retornar uma mensagem de conflito compreensível, mas não substituirá a constraint do banco. A confirmação do planejamento deverá gravar todas as sessões em uma única transação. Se a constraint ou outra validação detectar conflito, a transação inteira será revertida, sem gravação parcial. Um teste de integração deve verificar a constraint contra PostgreSQL real; SQLite não é substituto suficiente para validar esse comportamento específico.

### D8. Prévia stateless e confirmação integral

A prévia não será persistida no banco e não exigirá uma tabela `PreviaPlanejamento`. A API devolverá a proposta completa, incluindo semana, instante de referência, alocações e itens não alocados. O cliente enviará essa proposta de volta para confirmação.

A confirmação não confiará cegamente no payload recebido. O servidor carregará novamente as demandas, tarefas, disponibilidades e sessões, recalculará a proposta a partir dos dados enviados e do `Agora` original da prévia, e verificará que as alocações recebidas correspondem à proposta determinística recalculada. Também verificará, usando o instante atual real, que nenhuma sessão proposta começou ou passou a estar no passado.

Se a disponibilidade ou os registros relevantes tiverem mudado, a proposta enviada divergir do resultado recalculado ou algum horário deixar de ser válido, a API recusará a confirmação inteira com `409 Conflict`, sem persistir sessões, e solicitará uma nova prévia. Se estiver válida, gravará todas as sessões propostas na mesma transação. A constraint global de não sobreposição do PostgreSQL permanece como última linha de defesa contra concorrência.

O estudante poderá confirmar ou descartar a proposta. Edição das alocações ainda na prévia fica fora do MVP; depois da confirmação, as sessões seguem os endpoints existentes de gerenciamento de `SessaoEstudo`. O desenho final das rotas e DTOs HTTP deverá preservar esse contrato sem expor `Agora` como campo de entrada livre na criação da prévia.

### D9. Testes e validação

O contrato deverá ser coberto por testes automatizados antes da implementação do algoritmo. Os testes do algoritmo deverão usar dados e relógio fixos, sem depender da data real do computador.

A suíte deve cobrir: limites da semana e fuso horário; elegibilidade sem dupla contagem; todos os critérios de prioridade e desempate; intervalos menores, iguais e maiores que a duração; normalização de disponibilidades consecutivas/sobrepostas; limite de horários passados; todos os códigos de não alocação; sobrecarga; sessões existentes; intervalos consecutivos; rejeição de sobreposição; prévia sem persistência; confirmação integral; conflito entre prévia e confirmação; e rollback integral em caso de conflito no banco.

Os testes existentes que usam SQLite devem continuar cobrindo regras gerais sem regressões. A constraint de exclusão deve ter teste de integração que execute contra PostgreSQL real. A estratégia de infraestrutura de CI para garantir um PostgreSQL de teste será definida antes de implementar esse teste, sem manter duas estratégias de ciclo de vida do banco redundantes.

## Critérios de aceitação

- **CA-1 — Semana:** o planejador aceita somente um `InicioSemana` que seja segunda-feira local. A semana considera `[segunda 00:00, segunda seguinte 00:00)` e nenhuma disponibilidade fora desse intervalo entra no resultado.
- **CA-2 — Hora atual:** dado um `Agora` fixo, o corte para novas alocações é o próximo minuto completo que não seja anterior ao instante local de referência. Em testes, o resultado independe do relógio real.
- **CA-3 — Elegibilidade:** uma demanda sem tarefas gera no máximo uma atividade; uma demanda com tarefas gera somente atividades para suas tarefas ativas; demandas concluídas/canceladas e tarefas concluídas não são alocadas.
- **CA-4 — Prioridade:** para entradas idênticas, o planejador produz a mesma ordem conforme todos os critérios e desempates descritos em D4.
- **CA-5 — First-fit:** cada atividade é alocada inteira no primeiro intervalo contínuo livre cronologicamente que a comporta, sem arredondamento, divisão ou consumo de intervalos insuficientes.
- **CA-6 — Não alocadas:** toda atividade elegível que não for alocada aparece uma vez, com um código de motivo da lista fechada em D6.
- **CA-7 — Não sobreposição:** sessões consecutivas são permitidas; períodos sobrepostos são recusados pela API e pelo PostgreSQL. Sessões canceladas não bloqueiam horários.
- **CA-8 — Prévia:** gerar uma prévia não grava sessões nem outras alterações no banco.
- **CA-9 — Confirmação:** uma proposta válida grava todas as sessões em uma única transação; proposta stale, divergente ou conflitante é rejeitada integralmente, sem gravação parcial.
- **CA-10 — Compatibilidade:** demandas, tarefas, disponibilidades e sessões existentes continuam funcionando; a alteração reutiliza `SessaoEstudo` em vez de criar uma tabela paralela de sessões planejadas.
- **CA-11 — PostgreSQL real:** existe teste de integração executado contra PostgreSQL real para comprovar a constraint de exclusão.

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
