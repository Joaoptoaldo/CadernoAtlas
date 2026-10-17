# CadernoAtlas

O **CadernoAtlas** é uma API REST desenvolvida em C# e .NET 10 voltada à organização de estudos e ao planejamento acadêmico adaptativo. O projeto centraliza demandas acadêmicas (provas, trabalhos, atividades práticas e projetos), organiza tarefas executáveis e fornece priorização determinística e explicável com base em prazos, importância e situação atual do estudante.

Além da gestão de demandas acadêmicas, o sistema contempla a vertical de organização de editais de concursos públicos, permitindo estruturar disciplinas e tópicos hierárquicos de estudo.

---

## Funcionalidades Implementadas

### Demandas Acadêmicas
- **Cadastro e gerenciamento de demandas:** registro com título, descrição opcional, tipo (`Prova`, `Trabalho`, `APG`, `TCC`, `Outro`), prazo, nível de importância (`Baixa`, `Media`, `Alta`), esforço estimado em minutos e situação (`Pendente`, `EmAndamento`, `Concluida`, `Cancelada`).
- **Filtros avançados de consulta:** listagem com filtros combináveis por situação, tipo, importância e teto de prazo (`prazoAte` em formato `yyyy-MM-dd`).
- **Consistência e integridade:** validação que impede marcar uma demanda como `Concluida` caso ainda existam tarefas pendentes ou em andamento.
- **Preservação de histórico:** não disponibiliza exclusão física de demandas, mantendo o histórico acadêmico por meio de situações (ex.: cancelamento).

### Priorização Determinística e Explicável
- **Cálculo de urgência por fuso horário:** conversão do instante atual para o fuso configurado (`America/Sao_Paulo` por padrão) para determinar a data civil de referência de forma independente da máquina servidora.
- **Ordenação multicritério:** demandas pendentes e em andamento são priorizadas sequencialmente por:
  1. Faixa de urgência (`Atrasada`, `Vence hoje`, `Até 3 dias`, `Até 7 dias`, `Até 14 dias`, `Prazo distante`, `Sem prazo definido`);
  2. Prazo mais próximo;
  3. Grau de importância (`Alta` > `Média` > `Baixa`);
  4. Situação (`EmAndamento` tem precedência sobre `Pendente`);
  5. Título alfabético e identificador (desempate estável).
- **Justificativa em linguagem natural:** cada item priorizado acompanha um texto legível explicando o motivo de sua posição (ex.: *"Prazo em 2 dias; importância alta; situação em andamento."*).

### Tarefas de Demandas
- **Divisão em ações menores:** cada demanda pode conter múltiplas tarefas vinculadas, com título, descrição, ordem e situação (`Pendente`, `EmAndamento`, `Concluida`).
- **Sequenciamento automático:** novas tarefas recebem automaticamente a próxima ordem disponível dentro da demanda.
- **Controle de integridade de ciclo de vida:** impede o cadastro de novas tarefas ou a reabertura de tarefas existentes caso a demanda principal já esteja concluída.

### Sessões de Estudo
- **Planejamento de blocos de estudo:** registro de sessões com título, data planejada (`DateOnly`), horário de início (`TimeOnly`), duração planejada em minutos (1 a 1440 min) e observações opcionais.
- **Ciclo de vida e rastreamento temporal:** transições formais de estado entre `Planejada`, `EmAndamento`, `Concluida` e `Cancelada`, com registro de carimbos UTC de início real, conclusão e cancelamento.
- **Cálculo automático de duração real:** ao concluir ou cancelar uma sessão iniciada (`EmAndamento`), o sistema calcula e persiste a duração real em minutos com base no tempo decorrido.
- **Vínculos flexíveis e exclusivos:** suporte a vinculação opcional a uma demanda acadêmica ou a uma tarefa de demanda, com garantia de exclusividade mútua (não permite vincular ambos simultaneamente) ou execução avulsa sem vínculo.
- **Preservação e integridade do histórico:** apenas sessões no estado `Planejada` podem ser editadas ou excluídas fisicamente; sessões iniciadas, concluídas ou canceladas têm seus dados preservados contra exclusão.

### Editais de Concursos e Cadernos de Estudo
- **Concursos:** cadastro e gerenciamento completo (CRUD) de concursos, incluindo órgão, banca, número do edital, datas de publicação e de prova.
- **Disciplinas do edital:** gerenciamento das disciplinas vinculadas a cada concurso, com suporte a ordenação.
- **Tópicos e subtópicos hierárquicos:** árvore de tópicos do edital com status de estudo (`NaoIniciado`, `EmEstudo`, `Revisado`, `Concluido`), com validação contra ciclos e garantia de que ancestrais pertençam à mesma disciplina.
- **Cadernos de estudo:** gerenciamento de cadernos temáticos para consolidação de anotações e conteúdos.

---

## Tecnologias Utilizadas

- **Plataforma:** .NET 10 (C# 13)
- **Framework Web:** ASP.NET Core Web API (Controllers)
- **Acesso a Dados:** Entity Framework Core 10
- **Banco de Dados Principal:** PostgreSQL (via provedor `Npgsql.EntityFrameworkCore.PostgreSQL`)
- **Documentação de API:** OpenAPI nativo do ASP.NET Core (`Microsoft.AspNetCore.OpenApi`)
- **Testes Automatizados:** xUnit, `Microsoft.AspNetCore.Mvc.Testing` e SQLite em memória (`Microsoft.EntityFrameworkCore.Sqlite`)

---

## Arquitetura e Organização do Código

O projeto adota uma arquitetura direta em ASP.NET Core, priorizando clareza, simplicidade e baixo acoplamento sem abstrações desnecessárias:

```text
CadernoAtlas/
├── CadernoAtlas.slnx             # Arquivo de solução moderno em formato XML
├── src/
│   └── CadernoAtlas.Api/
│       ├── Contracts/            # DTOs de requisição e resposta organizados por entidade
│       │   ├── Cadernos/
│       │   ├── Concursos/
│       │   ├── DemandasAcademicas/
│       │   ├── DisciplinasEdital/
│       │   ├── SessoesEstudo/
│       │   ├── TarefasDemanda/
│       │   └── TopicosEdital/
│       ├── Controllers/          # Endpoints HTTP e coordenação de entrada/saída
│       ├── Data/
│       │   ├── AppDbContext.cs   # Contexto do EF Core com mapeamentos e restrições
│       │   └── Migrations/       # Migrações versionadas do banco de dados
│       ├── Models/               # Entidades de domínio e enums
│       ├── Services/             # Regras de negócio puras (ex.: priorizador e conversão de fuso)
│       ├── Program.cs            # Configuração do host, injeção de dependências e pipeline HTTP
│       └── appsettings.json      # Configurações não sensíveis da aplicação
└── tests/
    └── CadernoAtlas.Api.Tests/   # Suíte de testes automatizados com WebApplicationFactory
```

- **Controllers:** focados no protocolo HTTP, validação de parâmetros, orquestração e retorno de códigos de status semânticos (200, 201, 204, 400, 404, 409).
- **Services:** lógicas determinísticas isoladas e livres de efeitos colaterais de I/O, facilitando testes unitários e raciocínio técnico.
- **Data (EF Core):** mapeamento fluente com índices compostos, restrições de integridade no banco (`CHECK constraints`) e conversão de enums para string legível.

---

## Pré-requisitos

Para compilar e executar o projeto localmente, são necessários:

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [PostgreSQL](https://www.postgresql.org/) (versão 14 ou superior) em execução local ou via container
- [EF Core CLI Tools](https://learn.microsoft.com/ef/core/cli/dotnet) (opcional, para gerenciamento manual de migrações):
  ```bash
  dotnet tool install --global dotnet-ef
  ```

---

## Configuração do Banco de Dados e Segredos

As configurações não secretas de conexão estão definidas em `src/CadernoAtlas.Api/appsettings.json`:

```json
{
  "FusoHorario": "America/Sao_Paulo",
  "Database": {
    "Host": "127.0.0.1",
    "Port": 5432,
    "Name": "cadernoatlas",
    "Username": "cadernoatlas_app"
  }
}
```

A senha do banco de dados **não** deve ser inserida em arquivos versionados. O projeto utiliza o gerenciador de segredos do .NET (`User Secrets`) em desenvolvimento:

1. Defina a senha do banco no cofre do projeto:
   ```bash
   dotnet user-secrets set "Database:Password" "sua_senha_aqui" --project src/CadernoAtlas.Api
   ```

2. Crie o banco de dados no PostgreSQL (caso ainda não exista) com usuário correspondente:
   ```sql
   CREATE DATABASE cadernoatlas;
   ```

3. Aplique as migrações existentes para criar a estrutura de tabelas:
   ```bash
   dotnet ef database update --project src/CadernoAtlas.Api
   ```

---

## Como Executar Localmente

1. Restaure as dependências e compile a solução:
   ```bash
   dotnet build .\CadernoAtlas.slnx
   ```

2. Inicie a API:
   ```bash
   dotnet run --project src/CadernoAtlas.Api
   ```

A API estará disponível por padrão nas seguintes URLs (configuradas em `launchSettings.json`):
- **HTTP:** `http://localhost:5233`
- **HTTPS:** `https://localhost:7130`

### Verificação de Saúde em Desenvolvimento
Em ambiente de desenvolvimento (`Development`), há um endpoint utilitário para checar a conectividade com o banco:
- `GET /_dev/database-check`

### Documentação OpenAPI
Com a aplicação em execução no ambiente de desenvolvimento, a especificação OpenAPI pode ser consultada em:
- `http://localhost:5233/openapi/v1.json`

---

## Visão Geral da API

A API é estruturada em torno de controladores RESTful que atendem às duas vertentes do projeto: o planejamento acadêmico e a organização de editais de concursos.

### Principais Áreas Funcionais

- **Demandas Acadêmicas (`/api/demandas-academicas`):** cadastro, atualização e consulta filtrada de compromissos acadêmicos (provas, trabalhos, APG, TCC).
- **Priorização Adaptativa (`/api/demandas-academicas/priorizadas`):** ordenação determinística de demandas ativas com base em urgência, prazo, importância e situação, acompanhada de justificativa explicável e cálculo temporal pelo fuso horário configurado.
- **Tarefas de Demandas (`/api/demandas-academicas/{demandaId}/tarefas`):** subdivisão de demandas em ações menores com sequenciamento automático e regras estritas de ciclo de vida.
- **Sessões de Estudo (`/api/sessoes-estudo`):** planejamento, execução e controle de ciclo de vida de blocos de estudo, com cálculo de tempo real, suporte a cancelamento e vinculação exclusiva a demandas ou tarefas.
- **Concursos Públicos (`/api/concursos`):** gerenciamento de concursos, órgãos, bancas e datas de publicação/prova.
- **Disciplinas do Edital (`/api/concursos/{concursoId}/disciplinas`):** matérias vinculadas a concursos públicos.
- **Tópicos e Subtópicos (`/api/concursos/{concursoId}/disciplinas/{disciplinaId}/topicos`):** árvore hierárquica de conteúdos programáticos com acompanhamento de status de estudo e validação contra ciclos.
- **Cadernos de Estudo (`/api/cadernos`):** cadernos temáticos para consolidação de resumos e anotações.

Para consultar a documentação completa com todas as rotas, parâmetros, exemplos de requisição/resposta, códigos de status e regras de integridade:

**[Consultar documentação dos endpoints](docs/endpoints.md)**

---

## Testes Automatizados

A solução possui uma suíte de testes de integração e testes unitários cobrindo fluxos felizes, casos de borda, validações de entrada e regras de integridade.

Os testes de integração utilizam `CustomWebApplicationFactory`, substituindo a conexão PostgreSQL por um banco SQLite em memória (`Data Source=:memory:`). Com isso, a suíte de testes é totalmente determinística e **não requer** uma instância ativa do PostgreSQL para ser executada.

### Executando os testes

```bash
dotnet test .\CadernoAtlas.slnx
```

**Resultado verificado da suíte:**
- **78 testes aprovados**, 0 falhas, 0 ignorados.

---

## Estado Atual e Próximos Passos

### Concluído no MVP
- [x] CRUD completo de Concursos, Disciplinas e Tópicos hierárquicos com validação anti-ciclos.
- [x] CRUD completo de Cadernos de Estudo.
- [x] CRUD e filtros de Demandas Acadêmicas.
- [x] Sub-recurso de Tarefas com controle estrito de ciclo de vida e integridade.
- [x] Algoritmo determinístico de priorização com justificativas legíveis.
- [x] Gestão de fuso horário configurável na inicialização (`America/Sao_Paulo`).
- [x] Sessões de Estudo com ciclo de vida (`Planejada`, `EmAndamento`, `Concluida`, `Cancelada`), cálculo de duração real e vínculos exclusivos.
- [x] Suíte automatizada de testes com 78 testes aprovados.

### Planejado para Evoluções Futuras
- [ ] Módulo de planejamento semanal adaptativo baseado em disponibilidade real do estudante.
- [ ] Suporte a atividades recorrentes e replanejamento com redistribuição de carga horária.
- [ ] Autenticação e autorização multiusuário (contas e isolamento de dados).
- [ ] Interface visual / front-end web integrado à API.

---

## Contexto

Este repositório é um projeto de aprendizado contínuo e portfólio de engenharia de software focado em desenvolvimento de APIs robustas com .NET e Entity Framework Core. O código reflete práticas de validação de dados, modelagem relacional, consistência de ciclo de vida de recursos e testes automatizados.
