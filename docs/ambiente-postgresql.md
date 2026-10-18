# Ambiente local, conexões e migrations

Este procedimento descreve como configurar a API para um banco PostgreSQL remoto ou local, gerar um script SQL sem executá-lo, revisar esse script e aplicá-lo de forma controlada. Os comandos usam valores de exemplo; não substitua os placeholders por valores secretos em arquivos versionados ou na documentação.

## 1. Arquivo `.env` local

Em `Development`, [Program.cs](../src/CadernoAtlas.Api/Program.cs) executa `DotNetEnv.Env.NoClobber().TraversePath().Load()`. Isso procura o `.env` no caminho da aplicação e diretórios ascendentes, sem substituir variáveis de ambiente já definidas.

O repositório ignora `.env` explicitamente em [.gitignore](../.gitignore). Confirme localmente sem exibir o conteúdo:

```powershell
git check-ignore -v .env
git status --short --ignored .env
```

O resultado deve indicar a regra de `.gitignore`; o conteúdo do arquivo não deve ser impresso. A variável usada pela API é:

```text
ConnectionStrings__DefaultConnection=<string-de-conexao-local-ou-remota>
```

O nome com dois sublinhados representa `ConnectionStrings:DefaultConnection` na configuração .NET. A API exige essa chave ao iniciar. `appsettings.json` ainda contém configurações gerais, como `FusoHorario`, mas a conexão efetivamente lida por `Program.cs` é `ConnectionStrings:DefaultConnection`.

Não registre no `.env` commitado, no terminal compartilhado, em logs ou nesta documentação:

- senha;
- URL privada;
- host ou parâmetros que revelem uma infraestrutura restrita;
- string de conexão completa.

## 2. Três conexões com finalidades diferentes

Não misture os bancos nem reutilize uma conexão sem confirmar seu destino:

1. **API:** `ConnectionStrings__DefaultConnection`, carregada pela API em `Development`. É a conexão usada por `AppDbContext` durante a execução da aplicação e pode conter um endpoint com pooler quando ele for compatível com a operação.
2. **Aplicação direta de script:** a conexão fornecida diretamente ao comando `psql` que executa um arquivo SQL revisado. Para operações manuais de migration, obtenha uma conexão direta para o banco alvo e confira seu destino antes da execução. Não precisa ser salva no repositório nem ser a mesma variável da API.
3. **Testes PostgreSQL:** `CADERNOATLAS_POSTGRES_TEST_CONNECTION_STRING`, lida exclusivamente por `PostgreSqlSessoesEstudoFixture`. A fixture exige que o nome do banco termine em `_test` e aplica migrations automaticamente com `MigrateAsync()`. Use o banco dedicado `cadernoatlas_test`, nunca o banco de desenvolvimento. Os testes HTTP comuns não usam essa conexão: [CustomWebApplicationFactory.cs](../tests/CadernoAtlas.Api.Tests/CustomWebApplicationFactory.cs) substitui o contexto da aplicação por SQLite em memória.

Essa separação entre conexão da API e conexão direta para migrations é uma convenção operacional. O código não escolhe automaticamente entre endpoint com pooler e conexão direta.

## 3. Gerar um script sem executar migrations

O projeto contém migrations do EF Core no diretório `src/CadernoAtlas.Api/Data/Migrations` e referencia as ferramentas de design no projeto da API. Para gerar o SQL sem alterar o banco, execute:

```powershell
dotnet ef migrations script --project .\src\CadernoAtlas.Api --output .\artifacts\migrations.sql
```

Esse comando gera um arquivo local. Ele não é um comando de aplicação de schema. Se o projeto estiver configurado para gerar uma conexão durante a inicialização, forneça a configuração local necessária sem copiar a string para a linha de comando ou para logs.

Antes de compartilhar ou versionar o arquivo, confirme que ele não contém credenciais, URLs privadas ou dados que não pertençam ao script. O arquivo gerado deve ser tratado como artefato local; não o adicione ao Git.

## 4. Revisar o script antes de aplicar

Abra o arquivo localmente, sem colar seu conteúdo em chats, issues ou logs. A revisão deve confirmar:

- migrations na ordem esperada;
- criação e alteração de tabelas;
- `ALTER TABLE`, `DROP`, remoção de colunas e conversões de dados;
- constraints `CHECK`, chaves estrangeiras e ações de exclusão;
- índices, incluindo índices de suporte a constraints;
- SQL manual presente em `migrationBuilder.Sql`;
- locks, blocos transacionais e condições de erro;
- compatibilidade entre a migration, o snapshot do EF Core e o estado esperado do banco.

Para as migrations atuais, dê atenção especial à conversão de estimativas zero para `NULL` e à constraint de exclusão `EX_SessoesEstudo_SemSobreposicaoAtiva`, que envolve sessões `Planejada` e `EmAndamento`. Se a revisão encontrar alteração destrutiva, dados existentes conflitantes ou ordem insegura, pare e corrija o script ou a migration antes de aplicar.

A migration `20261017173404_AlinharEstimativaEsforcoDemandasAcademicas` não oferece reversão automática segura: seu método `Down` lança `NotSupportedException`, porque a conversão de zero para `NULL` não preserva quais registros foram alterados. Uma reversão segura requer restaurar um backup ou definir previamente um procedimento explícito de recuperação dos dados.

## 5. Aplicar somente o script revisado

Depois de confirmar o banco alvo e revisar o arquivo, execute `psql` com `ON_ERROR_STOP=1` para interromper no primeiro erro:

```powershell
psql "<string-de-conexao-do-banco-alvo>" -v ON_ERROR_STOP=1 -f .\artifacts\migrations.sql
```

Não use o banco de desenvolvimento como banco descartável de testes. Não execute esse comando contra um destino não confirmado. A string deve ser fornecida somente no processo local e não deve aparecer em histórico de shell compartilhado, logs ou documentação.

Se o comando falhar, preserve a saída do erro de forma segura, não ignore a falha e não execute novamente sem entender o estado deixado pela operação. Verifique o histórico e o estado do banco antes de decidir o próximo passo.

## 6. Verificar o resultado

Use consultas somente depois de confirmar a conexão. As consultas abaixo não expõem valores de conexão e verificam o histórico de migrations e as constraints:

```sql
SELECT "MigrationId", "ProductVersion"
FROM "__EFMigrationsHistory"
ORDER BY "MigrationId";
```

```sql
SELECT
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'SessoesEstudo'
ORDER BY constraint_name;
```

Confirme que o histórico contém as migrations esperadas e que `EX_SessoesEstudo_SemSobreposicaoAtiva` está presente. Para verificar a expressão completa de uma constraint PostgreSQL, use o catálogo do banco no ambiente autorizado, sem registrar a saída em documentação se ela contiver detalhes privados:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'EX_SessoesEstudo_SemSobreposicaoAtiva';
```

Compare o resultado com [20261017182658_ImpedirSobreposicaoSessoesAtivas.cs](../src/CadernoAtlas.Api/Data/Migrations/20261017182658_ImpedirSobreposicaoSessoesAtivas.cs). A existência da migration no histórico não substitui a execução dos testes PostgreSQL descritos em [testes-postgresql.md](testes-postgresql.md).

## 7. Iniciar a API e verificar a conexão

Com `ConnectionStrings__DefaultConnection` configurada no `.env`, inicie a API em `Development`:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project .\src\CadernoAtlas.Api
```

Com a API em execução, consulte:

```powershell
Invoke-WebRequest http://localhost:5233/_dev/database-check
```

O endpoint só é registrado em `Development`. `200 OK` com `{"status":"ok","database":"connected"}` confirma que o `AppDbContext` conseguiu conectar; `503 Service Unavailable` indica que a conexão não está disponível. Se a aplicação não iniciar por configuração ausente ou inválida, corrija a configuração sem imprimir a string de conexão.

## 8. Executar os testes mantendo os bancos separados

Para os testes gerais, execute:

```powershell
dotnet test .\CadernoAtlas.slnx
```

`CustomWebApplicationFactory` configura o ambiente como `Testing`, remove as opções registradas de `AppDbContext`, cria uma conexão SQLite em memória e registra `UseSqlite`. `InicializarBancoAsync()` usa `EnsureCreatedAsync()`. Portanto, esses testes não exercitam as migrations PostgreSQL nem a constraint de exclusão GiST.

Para a categoria que precisa do banco PostgreSQL, configure somente no processo atual a variável `CADERNOATLAS_POSTGRES_TEST_CONNECTION_STRING` apontando para `cadernoatlas_test` e execute:

```powershell
$env:CADERNOATLAS_POSTGRES_TEST_CONNECTION_STRING = "<string-de-conexao-do-banco-de-testes>"
dotnet test .\CadernoAtlas.slnx --filter "Category=PostgreSql"
```

A fixture carrega `.env` sem sobrescrever variáveis existentes, valida o sufixo `_test`, configura `UseNpgsql` diretamente e chama `MigrateAsync()`. Não aponte essa variável para o banco de desenvolvimento e não confunda `EnsureCreatedAsync()` dos testes HTTP com `MigrateAsync()` dos testes PostgreSQL.
