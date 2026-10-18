# Testes específicos do PostgreSQL

Os testes gerais usam SQLite em memória por meio de `CustomWebApplicationFactory`. Essa estratégia é adequada para controllers, validações e regras de negócio gerais, mas não substitui o PostgreSQL para a constraint de exclusão GiST que impede a sobreposição entre sessões `Planejada` e `EmAndamento`. SQLite não oferece essa mesma implementação de range types, índice GiST e exclusion constraint.

A configuração geral do ambiente, a geração de scripts e a aplicação revisada de migrations estão em [ambiente-postgresql.md](ambiente-postgresql.md). Este documento trata somente da categoria de testes que precisa de um banco PostgreSQL separado.

## Pré-requisitos

- PostgreSQL em execução.
- O banco descartável dedicado `cadernoatlas_test`.
- As migrations disponíveis no projeto.
- Uma connection string fornecida pela variável de ambiente `CADERNOATLAS_POSTGRES_TEST_CONNECTION_STRING`.

A fixture rejeita a execução se a variável não estiver definida. Ela também lê o nome do banco da connection string e exige que ele termine em `_test`; para esta suíte, configure o banco dedicado `cadernoatlas_test`. Essa proteção evita que a categoria seja executada acidentalmente contra o banco de desenvolvimento `cadernoatlas`. A variável não deve conter credenciais em documentação, logs ou arquivos versionados.

## Execução

No PowerShell, configure a variável apenas no processo da sessão atual e execute a categoria:

```powershell
$env:CADERNOATLAS_POSTGRES_TEST_CONNECTION_STRING = "<connection-string-do-banco-dedicado>"
dotnet test .\CadernoAtlas.slnx --filter "Category=PostgreSql"
```

O comando usa o trait `[Trait("Category", "PostgreSql")]` definido em `PostgreSqlSessoesEstudoTests.cs`. Não use o banco de desenvolvimento `cadernoatlas` como banco descartável. A separação entre o banco local de desenvolvimento e um banco dedicado de testes deve ser mantida também no CI.

## Comportamento da fixture

`PostgreSqlSessoesEstudoFixture.InitializeAsync`:

1. lê `CADERNOATLAS_POSTGRES_TEST_CONNECTION_STRING`;
2. valida o sufixo `_test` do nome do banco;
3. cria um `AppDbContext` configurado com `UseNpgsql`;
4. chama `Database.MigrateAsync()` antes dos testes.

Os testes usam transações por caso. A fixture não descarta nem recria o banco ao final; o banco dedicado deve ser provisionado e isolado pelo ambiente que executa a suíte.

## Cenários cobertos

Os testes verificam:

- sobreposição entre duas sessões `Planejada`;
- sobreposição entre sessões `Planejada` e `EmAndamento`;
- sessões ativas que atravessam a meia-noite;
- atualizações que passam a criar sobreposição;
- intervalos adjacentes que apenas tocam o limite `[início, fim)`;
- sessões `Concluida` ou `Cancelada` que podem sobrepor sessões ativas, pois não participam da constraint.

## Estado e pendências

Conforme confirmação recebida, a migration `20261017182658_ImpedirSobreposicaoSessoesAtivas` foi aplicada com sucesso ao banco local `cadernoatlas` por meio de um script SQL. Essa aplicação não comprova a execução dos testes específicos da constraint.

Em uma execução anterior, foram observados 8 testes aprovados nessa categoria. Esse resultado não corresponde a uma nova execução desta tarefa e não deve ser interpretado como aprovação atual da categoria sem os registros da execução específica. Ele também não comprova a reprodução de um conflito real de serialização `40001` no endpoint de confirmação.

A categoria deve ser executada com a variável de ambiente apontando para o banco dedicado `cadernoatlas_test`. A criação e o isolamento do banco no CI permanecem pendentes. Sem evidência específica da execução considerada, os testes presentes não devem ser descritos como aprovação ou reprovação da constraint.
