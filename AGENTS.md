# Instruções para agentes de IA — CadernoAtlas

## 1. Objetivo do projeto

O CadernoAtlas é uma **plataforma de organização e planejamento acadêmico adaptativo** em desenvolvimento com C#/.NET 10. O projeto ajuda estudantes com rotinas exigentes a centralizar demandas acadêmicas (provas, trabalhos, tarefas, atividades recorrentes), organizá-las com prioridades explícitas e ajustar seus planos conforme a realidade muda.

O objetivo é transformar um conjunto de obrigações acadêmicas em um plano de ação realista, organizado e ajustável à rotina do estudante, sem presumir disponibilidade ilimitada ou culpabilizar o usuário por dificuldades.

Funcionalmente, o projeto foi iniciado com foco em organização de concursos e editais. Essa verticalização continua válida e deve evoluir em coerência com a visão de planejamento adaptativo. Novos recursos devem ser alinhados com os princípios de produto (seção 3).

Trate a visão de produto como contexto para orientar decisões, não como especificação completa. Antes de implementar, confira o código atual e diferencie funcionalidades implementadas, decisões confirmadas e ideias futuras.

## 2. Princípios de produto

Incorpore os seguintes princípios ao avaliar decisões técnicas e de escopo:

1. **Planejamento adaptativo:** planos podem e devem ser ajustados quando a realidade do estudante mudar.
2. **Prioridades explicáveis:** recomendações devem ter critérios compreensíveis, sem decisões arbitrárias ou caixas-pretas desnecessárias.
3. **Ações concretas:** orientar sobre o próximo passo executável, em vez de apresentar listas extensas e vagas.
4. **Realismo:** considerar prazos, esforço, disponibilidade e dependências. Não presumir que tudo pode ser concluído simultaneamente.
5. **Controle do usuário:** o sistema pode sugerir prioridades, mas o estudante deve poder revisar e alterar as decisões.
6. **Evolução incremental:** desenvolver funcionalidades em etapas pequenas e verificáveis.
7. **Simplicidade antes da complexidade:** não introduzir abstrações, serviços, padrões ou tecnologias sem necessidade concreta.
8. **Validação de hipóteses:** tratar as necessidades identificadas como hipóteses a validar, sem presumir que representam todos os usuários.
9. **Continuidade:** preservar as funcionalidades já implementadas e evoluí-las coerentemente com a nova visão.
10. **Aprendizado técnico:** como o projeto também serve para aprofundar conhecimentos em C#, APIs, modelagem relacional e Entity Framework Core, as mudanças devem ser compreensíveis e justificadas.

## 3. Antes de alterar o código

1. Confirme a raiz do repositório e o estado do Git (`git rev-parse --show-toplevel` e `git status --short`).
2. Leia os arquivos relevantes e os testes existentes antes de propor mudanças.
3. Procure instruções adicionais em `AGENTS.md` nas pastas envolvidas.
4. Identifique o padrão já usado pelo projeto e prefira uma mudança pequena e coerente com ele.
5. Para refatorações amplas, mudanças de arquitetura, inclusão de dependências ou alterações no esquema do banco, apresente primeiro um plano curto com os arquivos afetados, o motivo e os impactos esperados. Aguarde revisão antes de executar essas mudanças.

Não presuma que um arquivo, tipo, endpoint, projeto de teste ou funcionalidade existe só porque aparece em documentação antiga. Verifique o estado atual do repositório.

## 4. Tecnologias e arquitetura

O projeto foi iniciado como uma ASP.NET Core Web API com controllers em .NET 10. A configuração conhecida inclui Entity Framework Core, o provedor Npgsql para PostgreSQL e OpenAPI. A solução fica em `CadernoAtlas.slnx`, e o projeto principal conhecido fica em `src/CadernoAtlas.Api`.

Use esses dados como ponto de partida e confira os arquivos `.slnx`, `.csproj`, `Program.cs` e `appsettings*.json` antes de depender de uma configuração específica.

- Respeite a arquitetura que realmente existe. Não introduza Clean Architecture, CQRS, MediatR, repositórios genéricos, interfaces ou camadas adicionais apenas por preferência.
- Mantenha controllers focados em HTTP, validação de entrada e coordenação. Coloque lógica de negócio fora do controller quando sua complexidade justificar essa separação.
- Use Entity Framework Core seguindo os padrões já existentes no projeto. Não misture acesso direto via SQL e EF Core sem uma necessidade concreta.
- Não crie DTOs, serviços ou abstrações automaticamente para cada classe. Introduza-os quando melhorarem a separação de responsabilidades ou a segurança do contrato HTTP.
- Prefira recursos assíncronos nas operações de I/O e propague `CancellationToken` quando apropriado e compatível com os padrões existentes.
- Preserve nullable reference types e implicit usings conforme configurados no projeto.

## 5. C# e estilo

- Siga `.editorconfig` e os padrões de código já usados no repositório.
- Use nomes em `PascalCase` para tipos e membros públicos; use `camelCase` para parâmetros e variáveis locais.
- Prefira código claro e direto a abstrações ou generalizações prematuras.
- Evite comentários que apenas repetem o código. Explique decisões ou restrições não óbvias.
- Não adicione documentação XML a todos os membros mecanicamente; documente APIs públicas quando isso trouxer valor real.
- Mantenha as alterações focadas na tarefa solicitada.

## 6. Banco de dados e migrations

O ambiente de desenvolvimento foi configurado para usar PostgreSQL local, com configurações não secretas em `appsettings.json` e senha em User Secrets. Confirme a configuração real antes de executar operações no banco.

- Não coloque senhas, tokens, chaves ou connection strings com credenciais em código, exemplos versionados, logs ou documentação.
- Não execute `dotnet user-secrets list` em uma sessão cujo resultado possa ser exposto, porque ele pode revelar segredos.
- Não altere nem apague bancos de outros projetos. O banco do CadernoAtlas conhecido é `cadernoatlas`; verifique host, porta e banco antes de operações manuais.
- Nunca execute comandos destrutivos, como `DROP DATABASE`, nem apague dados, migrations ou diretórios de dados sem solicitação e aprovação explícitas.
- Antes de criar ou alterar uma migration, examine as migrations existentes, o modelo e o estado do projeto. Alterações de esquema devem ser representadas por migrations do EF Core, salvo decisão explícita diferente.
- Não aplique migrations a um banco sem confirmar que a connection string aponta para o ambiente correto.
- Não presuma que tabelas foram criadas só porque o banco existe ou o build passou.

## 7. Produto e regras de negócio

O CadernoAtlas está evoluindo de uma ferramenta centrada em concursos e editais para uma plataforma de organização e planejamento acadêmico adaptativo. Ambas as vertentes devem conviver e evoluir coerentemente.

**Funcionalidades implementadas:**
- Cadastro e gerenciamento de concursos.
- Cadastro e gerenciamento de cadernos de estudo.
- Cadastro e gerenciamento de disciplinas vinculadas a concursos.
- Cadastro e gerenciamento de tópicos de edital, com subtópicos, status de estudo e ordenação.

**Direção planejada para o MVP expandido:**
- Cadastro de demandas acadêmicas genéricas (provas, trabalhos, tarefas, atividades recorrentes).
- Registro de prazos, importância, esforço estimado e situação.
- Divisão de demandas em tarefas menores.
- Consulta de demandas e progresso.
- Organização e priorização de atividades.
- Planejamento semanal e replanejamento adaptativo (evolução posterior).

Confirme quais funcionalidades foram implementadas antes de reutilizar ou ampliar seus conceitos. Não invente regras de negócio nem marque funcionalidades planejadas como concluídas. Ao registrar demandas, acertos ou progresso, preserve a consistência dos dados e evite métricas cuja definição não esteja clara.

## 8. Testes e validação

Para o fluxo completo de trabalho, consulte `docs/fluxo-agentes.md`, que detalha preparação, análise, implementação, testes e validação.

Depois de mudanças no código:

1. Execute `dotnet build .\CadernoAtlas.slnx`.
2. Verifique se há projetos de teste; se houver, execute `dotnet test .\CadernoAtlas.slnx` ou os testes relevantes.
3. Execute verificações adicionais apenas quando forem aplicáveis e disponíveis no repositório.
4. Revise o diff para confirmar que não há alterações não relacionadas.

Não afirme que testes passaram se não foram executados. Se uma verificação não puder ser executada, informe qual foi e por quê. Não esconda avisos ou falhas de compilação.

## 9. Git e preservação do trabalho

- Inspecione `git status --short` antes de editar e antes de concluir.
- Preserve alterações preexistentes do usuário. Não as sobrescreva, descarte ou reformate em massa.
- Não execute `git reset --hard`, `git clean`, checkout/restauração destrutiva, rebase, commit ou push sem solicitação explícita.
- Não altere a configuração ou o diretório `.git` sem antes explicar o problema e obter aprovação.
- Não modifique arquivos fora do escopo solicitado.

## 10. Dependências e mudanças de escopo

Não instale pacotes nem altere versões de SDK, pacotes ou ferramentas sem explicar a necessidade e o impacto esperado. Para mudanças de dependências, arquitetura, esquema de banco ou contratos públicos, apresente o plano para revisão antes de executar.

Prefira a menor mudança que resolva o problema. Não antecipe requisitos hipotéticos nem acrescente funcionalidades não solicitadas.

## 11. Relato final

Ao concluir uma tarefa, resuma:

- o que mudou e por quê;
- os arquivos afetados;
- os comandos de validação executados e seus resultados;
- limitações, riscos ou etapas que ficaram pendentes.

Se algo não foi verificado, diga isso explicitamente.
