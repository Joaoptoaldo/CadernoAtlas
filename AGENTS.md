# Instruções para agentes de IA — CadernoAtlas

## 1. Objetivo do projeto

O CadernoAtlas é uma aplicação em desenvolvimento com C#/.NET. A direção planejada do produto é ajudar estudantes e candidatos a concursos públicos a organizar a preparação, acompanhar o conteúdo do edital e analisar o próprio desempenho. Cadernos e anotações continuam fazendo parte da ideia original.

Trate essa direção como contexto de produto, não como prova de que essas funcionalidades já existem. Antes de implementar algo, confira o código atual e diferencie funcionalidades implementadas, decisões confirmadas e ideias futuras.

## 2. Antes de alterar o código

1. Confirme a raiz do repositório e o estado do Git (`git rev-parse --show-toplevel` e `git status --short`).
2. Leia os arquivos relevantes e os testes existentes antes de propor mudanças.
3. Procure instruções adicionais em `AGENTS.md` nas pastas envolvidas.
4. Identifique o padrão já usado pelo projeto e prefira uma mudança pequena e coerente com ele.
5. Para refatorações amplas, mudanças de arquitetura, inclusão de dependências ou alterações no esquema do banco, apresente primeiro um plano curto com os arquivos afetados, o motivo e os impactos esperados. Aguarde revisão antes de executar essas mudanças.

Não presuma que um arquivo, tipo, endpoint, projeto de teste ou funcionalidade existe só porque aparece em documentação antiga. Verifique o estado atual do repositório.

## 3. Tecnologias e arquitetura

O projeto foi iniciado como uma ASP.NET Core Web API com controllers em .NET 10. A configuração conhecida inclui Entity Framework Core, o provedor Npgsql para PostgreSQL e OpenAPI. A solução fica em `CadernoAtlas.slnx`, e o projeto principal conhecido fica em `src/CadernoAtlas.Api`.

Use esses dados como ponto de partida e confira os arquivos `.slnx`, `.csproj`, `Program.cs` e `appsettings*.json` antes de depender de uma configuração específica.

- Respeite a arquitetura que realmente existe. Não introduza Clean Architecture, CQRS, MediatR, repositórios genéricos, interfaces ou camadas adicionais apenas por preferência.
- Mantenha controllers focados em HTTP, validação de entrada e coordenação. Coloque lógica de negócio fora do controller quando sua complexidade justificar essa separação.
- Use Entity Framework Core seguindo os padrões já existentes no projeto. Não misture acesso direto via SQL e EF Core sem uma necessidade concreta.
- Não crie DTOs, serviços ou abstrações automaticamente para cada classe. Introduza-os quando melhorarem a separação de responsabilidades ou a segurança do contrato HTTP.
- Prefira recursos assíncronos nas operações de I/O e propague `CancellationToken` quando apropriado e compatível com os padrões existentes.
- Preserve nullable reference types e implicit usings conforme configurados no projeto.

## 4. C# e estilo

- Siga `.editorconfig` e os padrões de código já usados no repositório.
- Use nomes em `PascalCase` para tipos e membros públicos; use `camelCase` para parâmetros e variáveis locais.
- Prefira código claro e direto a abstrações ou generalizações prematuras.
- Evite comentários que apenas repetem o código. Explique decisões ou restrições não óbvias.
- Não adicione documentação XML a todos os membros mecanicamente; documente APIs públicas quando isso trouxer valor real.
- Mantenha as alterações focadas na tarefa solicitada.

## 5. Banco de dados e migrations

O ambiente de desenvolvimento foi configurado para usar PostgreSQL local, com configurações não secretas em `appsettings.json` e senha em User Secrets. Confirme a configuração real antes de executar operações no banco.

- Não coloque senhas, tokens, chaves ou connection strings com credenciais em código, exemplos versionados, logs ou documentação.
- Não execute `dotnet user-secrets list` em uma sessão cujo resultado possa ser exposto, porque ele pode revelar segredos.
- Não altere nem apague bancos de outros projetos. O banco do CadernoAtlas conhecido é `cadernoatlas`; verifique host, porta e banco antes de operações manuais.
- Nunca execute comandos destrutivos, como `DROP DATABASE`, nem apague dados, migrations ou diretórios de dados sem solicitação e aprovação explícitas.
- Antes de criar ou alterar uma migration, examine as migrations existentes, o modelo e o estado do projeto. Alterações de esquema devem ser representadas por migrations do EF Core, salvo decisão explícita diferente.
- Não aplique migrations a um banco sem confirmar que a connection string aponta para o ambiente correto.
- Não presuma que tabelas foram criadas só porque o banco existe ou o build passou.

## 6. Produto e regras de negócio

As funcionalidades de edital verticalizado, disciplinas e tópicos, ciclo de estudos, sessões de estudo, desempenho em questões, revisões e anotações relacionadas a concursos são direções planejadas. Confirme quais foram implementadas antes de reutilizar ou ampliar seus conceitos.

- Não invente regras de negócio ou marque funcionalidades planejadas como concluídas.
- Antes de alterar uma regra já implementada, identifique os comportamentos e telas/endpoints afetados.
- Ao registrar questões, acertos ou progresso, preserve a consistência dos dados e evite métricas cuja definição não esteja clara.
- Não trate recomendações de estudo como garantias de aprovação ou de resultado.

## 7. Testes e validação

Depois de mudanças no código:

1. Execute `dotnet build .\CadernoAtlas.slnx`.
2. Verifique se há projetos de teste; se houver, execute `dotnet test .\CadernoAtlas.slnx` ou os testes relevantes.
3. Execute verificações adicionais apenas quando forem aplicáveis e disponíveis no repositório.
4. Revise o diff para confirmar que não há alterações não relacionadas.

Não afirme que testes passaram se não foram executados. Se uma verificação não puder ser executada, informe qual foi e por quê. Não esconda avisos ou falhas de compilação.

## 8. Git e preservação do trabalho

- Inspecione `git status --short` antes de editar e antes de concluir.
- Preserve alterações preexistentes do usuário. Não as sobrescreva, descarte ou reformate em massa.
- Não execute `git reset --hard`, `git clean`, checkout/restauração destrutiva, rebase, commit ou push sem solicitação explícita.
- Não altere a configuração ou o diretório `.git` sem antes explicar o problema e obter aprovação.
- Não modifique arquivos fora do escopo solicitado.

## 9. Dependências e mudanças de escopo

Não instale pacotes nem altere versões de SDK, pacotes ou ferramentas sem explicar a necessidade e o impacto esperado. Para mudanças de dependências, arquitetura, esquema de banco ou contratos públicos, apresente o plano para revisão antes de executar.

Prefira a menor mudança que resolva o problema. Não antecipe requisitos hipotéticos nem acrescente funcionalidades não solicitadas.

## 10. Relato final

Ao concluir uma tarefa, resuma:

- o que mudou e por quê;
- os arquivos afetados;
- os comandos de validação executados e seus resultados;
- limitações, riscos ou etapas que ficaram pendentes.

Se algo não foi verificado, diga isso explicitamente.
