using System.Net;
using System.Net.Http.Json;
using CadernoAtlas.Api.Contracts.SessoesEstudo;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Npgsql;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CadernoAtlas.Api.Tests;

[CollectionDefinition(
    "PostgreSQL sessões de estudo",
    DisableParallelization = true)]
public sealed class PostgreSqlSessoesEstudoCollection : ICollectionFixture<PostgreSqlSessoesEstudoFixture>
{
    public const string Nome = "PostgreSQL sessões de estudo";
}

public sealed class PostgreSqlSessoesEstudoFixture : IAsyncLifetime
{
    public const string NomeVariavelConexao = "CADERNOATLAS_POSTGRES_TEST_CONNECTION_STRING";

    private string _connectionString = string.Empty;

    public async Task InitializeAsync()
    {
        DotNetEnv.Env.NoClobber().TraversePath().Load();

        var connectionString = Environment.GetEnvironmentVariable(
            NomeVariavelConexao);

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"Defina {NomeVariavelConexao} para executar os testes PostgreSQL " +
                "em um banco descartável dedicado. Os testes não usam a conexão da aplicação.");
        }

        var connection = new NpgsqlConnectionStringBuilder(connectionString);
        var nomeBanco = connection.Database ?? string.Empty;
        var nomeBancoIdentificaTeste = nomeBanco.EndsWith(
            "_test",
            StringComparison.OrdinalIgnoreCase);

        if (!nomeBancoIdentificaTeste)
        {
            throw new InvalidOperationException(
                $"O banco informado em {NomeVariavelConexao} deve ter 'test' " +
                "como segmento do nome, por exemplo 'cadernoatlas_test'.");
        }

        _connectionString = connection.ConnectionString;

        await using var dbContext = CreateDbContext();
        await dbContext.Database.MigrateAsync();
    }

    public AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_connectionString)
            .Options;

        return new AppDbContext(options);
    }

    public string ConnectionString => _connectionString;

    public Task DisposeAsync() => Task.CompletedTask;
}

[Collection(PostgreSqlSessoesEstudoCollection.Nome)]
[Trait("Category", "PostgreSql")]
public sealed class PostgreSqlSessoesEstudoEndpointTests(
    PostgreSqlSessoesEstudoFixture fixture)
{
    [Fact]
    public async Task CriarSessaoSobreposta_RetornaConflict()
    {
        using var factory = new PostgreSqlWebApplicationFactory(
            fixture.ConnectionString);
        using var client = factory.CreateClient();
        var data = NovaData();
        var titulo = $"Sessão HTTP PostgreSQL {Guid.NewGuid():N}";

        try
        {
            var primeira = await client.PostAsJsonAsync(
                "/api/sessoes-estudo",
                CriarRequest(
                    titulo,
                    data,
                    new TimeOnly(9, 0),
                    60));

            Assert.Equal(HttpStatusCode.Created, primeira.StatusCode);

            var segunda = await client.PostAsJsonAsync(
                "/api/sessoes-estudo",
                CriarRequest(
                    titulo,
                    data,
                    new TimeOnly(9, 30),
                    60));

            Assert.Equal(HttpStatusCode.Conflict, segunda.StatusCode);
            Assert.Equal(
                "Sessão sobreposta.",
                (await segunda.Content.ReadFromJsonAsync<ProblemDetails>())?.Title);
        }
        finally
        {
            await RemoverSessoesAsync(fixture, titulo);
        }
    }

    [Fact]
    public async Task CriarSessoesSobrepostasConcorrentemente_ApenasUmaEhCriada()
    {
        using var factory = new PostgreSqlWebApplicationFactory(
            fixture.ConnectionString);
        using var client = factory.CreateClient();

        var data = NovaData();
        var identificador = Guid.NewGuid().ToString("N");
        var tituloA = $"Sessão concorrente A {identificador}";
        var tituloB = $"Sessão concorrente B {identificador}";

        try
        {
            // Inicia as duas requisições sem aguardar a primeira terminar.
            var requisicaoA = client.PostAsJsonAsync(
                "/api/sessoes-estudo",
                CriarRequest(
                    tituloA,
                    data,
                    new TimeOnly(9, 0),
                    60));

            var requisicaoB = client.PostAsJsonAsync(
                "/api/sessoes-estudo",
                CriarRequest(
                    tituloB,
                    data,
                    new TimeOnly(9, 30),
                    60));

            var respostas = await Task.WhenAll(
                requisicaoA,
                requisicaoB);

            Assert.Equal(
                1,
                respostas.Count(
                    resposta => resposta.StatusCode == HttpStatusCode.Created));

            Assert.Equal(
                1,
                respostas.Count(
                    resposta => resposta.StatusCode == HttpStatusCode.Conflict));

            var conflito = Assert.Single(
                respostas,
                resposta => resposta.StatusCode == HttpStatusCode.Conflict);

            var problema = await conflito.Content
                .ReadFromJsonAsync<ProblemDetails>();

            Assert.Equal("Sessão sobreposta.", problema?.Title);

            // Confirma que apenas uma das sessões foi persistida.
            await using var dbContext = fixture.CreateDbContext();

            var sessoesPersistidas = await dbContext.SessoesEstudo
                .CountAsync(sessao =>
                    sessao.Titulo == tituloA ||
                    sessao.Titulo == tituloB);

            Assert.Equal(1, sessoesPersistidas);
        }
        finally
        {
            await RemoverSessoesAsync(
                fixture,
                tituloA,
                tituloB);
        }
    }

    [Fact]
    public async Task AtualizarSessaoSobreposta_RetornaConflict()
    {
        using var factory = new PostgreSqlWebApplicationFactory(
            fixture.ConnectionString);
        using var client = factory.CreateClient();
        var data = NovaData();
        var titulo = $"Sessão HTTP PostgreSQL {Guid.NewGuid():N}";
        var tituloAtualizado = $"{titulo} atualizada";

        try
        {
            var primeira = await client.PostAsJsonAsync(
                "/api/sessoes-estudo",
                CriarRequest(
                    titulo,
                    data,
                    new TimeOnly(9, 0),
                    60));
            var segunda = await client.PostAsJsonAsync(
                "/api/sessoes-estudo",
                CriarRequest(
                    titulo,
                    data,
                    new TimeOnly(11, 0),
                    60));

            Assert.Equal(HttpStatusCode.Created, primeira.StatusCode);
            Assert.Equal(HttpStatusCode.Created, segunda.StatusCode);

            var segundaCriada = await segunda.Content
                .ReadFromJsonAsync<SessaoEstudoResponse>();

            Assert.NotNull(segundaCriada);

            var atualizacao = await client.PutAsJsonAsync(
                $"/api/sessoes-estudo/{segundaCriada.Id}",
                new AtualizarSessaoEstudoRequest
                {
                    Titulo = tituloAtualizado,
                    DataPlanejada = data,
                    HoraInicioPlanejada = new TimeOnly(9, 30),
                    DuracaoPlanejadaMinutos = 60
                });

            Assert.Equal(HttpStatusCode.Conflict, atualizacao.StatusCode);
            Assert.Equal(
                "Sessão sobreposta.",
                (await atualizacao.Content.ReadFromJsonAsync<ProblemDetails>())?.Title);
        }
        finally
        {
            await RemoverSessoesAsync(fixture, titulo, tituloAtualizado);
        }
    }

    private static async Task RemoverSessoesAsync(
        PostgreSqlSessoesEstudoFixture fixture,
        params string[] titulos)
    {
        await using var dbContext = fixture.CreateDbContext();
        var sessoes = await dbContext.SessoesEstudo
            .Where(sessao => titulos.Contains(sessao.Titulo))
            .ToListAsync();

        dbContext.SessoesEstudo.RemoveRange(sessoes);
        await dbContext.SaveChangesAsync();
    }

    private static CriarSessaoEstudoRequest CriarRequest(
        string titulo,
        DateOnly data,
        TimeOnly horaInicio,
        int duracao)
    {
        return new CriarSessaoEstudoRequest
        {
            Titulo = titulo,
            DataPlanejada = data,
            HoraInicioPlanejada = horaInicio,
            DuracaoPlanejadaMinutos = duracao
        };
    }

    private static DateOnly NovaData()
    {
        return new DateOnly(2030, 1, 1)
            .AddDays(Random.Shared.Next(0, 30_000));
    }
}

[Collection(PostgreSqlSessoesEstudoCollection.Nome)]
[Trait("Category", "PostgreSql")]
public sealed class PostgreSqlSessoesEstudoTests(
    PostgreSqlSessoesEstudoFixture fixture)
{
    [Fact]
    public async Task DuasSessoesPlanejadasSobrepostas_SaoRejeitadasComSqlState23P01()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();
        var data = NovaData();

        dbContext.SessoesEstudo.Add(CriarSessao(
            data, new TimeOnly(9, 0), 60));
        await dbContext.SaveChangesAsync();

        dbContext.SessoesEstudo.Add(CriarSessao(
            data, new TimeOnly(9, 30), 60));

        var excecao = await Assert.ThrowsAsync<DbUpdateException>(
            () => dbContext.SaveChangesAsync());

        Assert.Equal("23P01", EncontrarSqlState(excecao));
    }

    [Fact]
    public async Task SessaoPlanejadaESessaoEmAndamentoSobrepostas_SaoRejeitadas()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();
        var data = NovaData();

        dbContext.SessoesEstudo.Add(CriarSessao(
            data, new TimeOnly(9, 0), 60));
        await dbContext.SaveChangesAsync();

        dbContext.SessoesEstudo.Add(CriarSessao(
            data,
            new TimeOnly(9, 30),
            60,
            SituacaoSessaoEstudo.EmAndamento));

        var excecao = await Assert.ThrowsAsync<DbUpdateException>(
            () => dbContext.SaveChangesAsync());

        Assert.Equal("23P01", EncontrarSqlState(excecao));
    }

    [Fact]
    public async Task SessoesPlanejadasAdjacentes_SaoPermitidas()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();
        var data = NovaData();

        dbContext.SessoesEstudo.AddRange(
            CriarSessao(data, new TimeOnly(9, 0), 60),
            CriarSessao(data, new TimeOnly(10, 0), 60));

        await dbContext.SaveChangesAsync();

        Assert.Equal(2, await dbContext.SessoesEstudo.CountAsync());
    }

    [Fact]
    public async Task SessaoConcluidaPodeSobreporSessaoPlanejada()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();
        var data = NovaData();

        dbContext.SessoesEstudo.AddRange(
            CriarSessao(data, new TimeOnly(9, 0), 60),
            CriarSessao(
                data,
                new TimeOnly(9, 30),
                60,
                SituacaoSessaoEstudo.Concluida));

        await dbContext.SaveChangesAsync();

        Assert.Equal(2, await dbContext.SessoesEstudo.CountAsync());
    }

    [Fact]
    public async Task SessaoCanceladaPodeSobreporSessaoEmAndamento()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();
        var data = NovaData();

        dbContext.SessoesEstudo.AddRange(
            CriarSessao(
                data,
                new TimeOnly(9, 0),
                60,
                SituacaoSessaoEstudo.EmAndamento),
            CriarSessao(
                data,
                new TimeOnly(9, 30),
                60,
                SituacaoSessaoEstudo.Cancelada));

        await dbContext.SaveChangesAsync();

        Assert.Equal(2, await dbContext.SessoesEstudo.CountAsync());
    }

    [Fact]
    public async Task SessoesAtivasQueSeSobrepoemAtravessandoMeiaNoite_SaoRejeitadas()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();
        var data = NovaData();

        dbContext.SessoesEstudo.Add(
            CriarSessao(data, new TimeOnly(23, 30), 90));
        await dbContext.SaveChangesAsync();

        dbContext.SessoesEstudo.Add(
            CriarSessao(data.AddDays(1), new TimeOnly(0, 30), 60));

        var excecao = await Assert.ThrowsAsync<DbUpdateException>(
            () => dbContext.SaveChangesAsync());

        Assert.Equal("23P01", EncontrarSqlState(excecao));
    }

    [Fact]
    public async Task IntervalosQueApenasTocamOLimite_SaoPermitidos()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();
        var data = NovaData();

        dbContext.SessoesEstudo.AddRange(
            CriarSessao(data, new TimeOnly(8, 0), 90),
            CriarSessao(data, new TimeOnly(9, 30), 30));

        await dbContext.SaveChangesAsync();

        Assert.Equal(2, await dbContext.SessoesEstudo.CountAsync());
    }

    [Fact]
    public async Task AtualizacaoQueCriaSobreposicao_ERejeitadaComSqlState23P01()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();
        var data = NovaData();
        var primeira = CriarSessao(data, new TimeOnly(9, 0), 60);
        var segunda = CriarSessao(data, new TimeOnly(11, 0), 60);

        dbContext.SessoesEstudo.AddRange(primeira, segunda);
        await dbContext.SaveChangesAsync();

        segunda.HoraInicioPlanejada = new TimeOnly(9, 30);

        var excecao = await Assert.ThrowsAsync<DbUpdateException>(
            () => dbContext.SaveChangesAsync());

        Assert.Equal("23P01", EncontrarSqlState(excecao));
    }

    private static SessaoEstudo CriarSessao(
        DateOnly data,
        TimeOnly horaInicio,
        int duracaoMinutos,
        SituacaoSessaoEstudo situacao = SituacaoSessaoEstudo.Planejada)
    {
        return new SessaoEstudo
        {
            Titulo = "Sessão de integração",
            DataPlanejada = data,
            HoraInicioPlanejada = horaInicio,
            DuracaoPlanejadaMinutos = duracaoMinutos,
            Situacao = situacao
        };
    }

    private static DateOnly NovaData()
    {
        return new DateOnly(2030, 1, 1)
            .AddDays(Random.Shared.Next(0, 30_000));
    }

    private static string? EncontrarSqlState(Exception excecao)
    {
        for (Exception? atual = excecao; atual is not null; atual = atual.InnerException)
        {
            if (atual is PostgresException postgresException)
            {
                return postgresException.SqlState;
            }
        }

        return null;
    }
}

internal sealed class PostgreSqlWebApplicationFactory(
    string connectionString)
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting(
            "ConnectionStrings:DefaultConnection",
            connectionString);
        builder.UseSetting("FusoHorario", "America/Sao_Paulo");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<
                IDbContextOptionsConfiguration<AppDbContext>>();
            services.RemoveAll<
                DbContextOptions<AppDbContext>>();
            services.RemoveAll<AppDbContext>();

            services.AddDbContext<AppDbContext>(
                options => options.UseNpgsql(connectionString));
        });
    }
}
