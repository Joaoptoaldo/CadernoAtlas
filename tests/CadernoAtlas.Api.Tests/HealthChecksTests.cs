using System.Net;
using System.Net.Http.Json;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CadernoAtlas.Api.Tests;

public sealed class HealthChecksTests
{
    [Fact]
    public async Task Liveness_RetornaSucessoSemDependenciaDoBanco()
    {
        using var factory = new CustomWebApplicationFactory(
            bancoDisponivel: false);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json; charset=utf-8", response.Content.Headers.ContentType?.ToString());

        var body = await response.Content.ReadFromJsonAsync<HealthResponse>();
        Assert.NotNull(body);
        Assert.Equal("Healthy", body!.Status);
    }

    [Fact]
    public async Task TratamentoGlobal_Retorna500SemExporDetalhesDaExcecao()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/_test/unexpected-exception");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Detalhe interno", content);
        Assert.DoesNotContain("InvalidOperationException", content);
        Assert.DoesNotContain("StackTrace", content);
    }

    [Fact]
    public async Task Readiness_RetornaSucessoQuandoBancoDisponivel()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json; charset=utf-8", response.Content.Headers.ContentType?.ToString());

        var body = await response.Content.ReadFromJsonAsync<HealthResponse>();
        Assert.NotNull(body);
        Assert.Equal("Healthy", body!.Status);
    }

    [Fact]
    public async Task Readiness_Retorna503QuandoBancoIndisponivel()
    {
        using var factory = new CustomWebApplicationFactory(
            bancoDisponivel: false);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/ready");

        Assert.Equal(
            HttpStatusCode.ServiceUnavailable,
            response.StatusCode);

        var body = await response.Content
            .ReadFromJsonAsync<HealthResponse>();

        Assert.NotNull(body);
        Assert.Equal("Unhealthy", body!.Status);

        var content = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("unavailable", content);
        Assert.DoesNotContain("ConnectionString", content);
    }

    [Fact]
    public async Task HealthChecks_NaoModificamDadosDoBanco()
    {
        // A factory usa EnsureCreatedAsync() (não migrations), então GetAppliedMigrationsAsync()
        // retorna vazio. Este teste verifica apenas que health checks não alteram dados existentes.
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.DemandasAcademicas.Add(new DemandaAcademica
        {
            Titulo = "Registro de controle"
        });
        await dbContext.SaveChangesAsync();

        var quantidadeAntes = await dbContext.DemandasAcademicas.CountAsync();

        var liveResponse = await client.GetAsync("/health/live");
        var readyResponse = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, liveResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, readyResponse.StatusCode);

        var quantidadeDepois = await dbContext.DemandasAcademicas.CountAsync();

        Assert.Equal(quantidadeAntes, quantidadeDepois);
    }

    [Fact]
    public async Task TratamentoGlobal_NaoInterfereErrosDeNegocio_BadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/demandas-academicas",
            new { titulo = "A" }); // 1 caractere - falha na validação (mínimo 2)

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problema = await response.Content.ReadFromJsonAsync<ProblemDetailsResponse>();
        Assert.NotNull(problema);
        // Validação automática do [ApiController] retorna ValidationProblem genérico
        Assert.Contains("validation", problema!.Title.ToLowerInvariant());
    }

    [Fact]
    public async Task TratamentoGlobal_NaoInterfereErrosDeNegocio_NotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/demandas-academicas/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task TratamentoGlobal_NaoInterfereErrosDeNegocio_PrimeiraCriacao_RetornaOk()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/demandas-academicas",
            new { titulo = "Tarefa 1", tipo = 0, importancia = 2 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task TratamentoGlobal_NaoInterfereErrosDeNegocio_Conflito_RetornaConflict()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var criacao = await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new { titulo = "Tarefa 1", tipo = 0, importancia = 2 });

        var demanda = await criacao.Content
            .ReadFromJsonAsync<DemandaAcademicaResponse>();
        Assert.NotNull(demanda);

        var conclusao = await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{demanda!.Id}",
            new
            {
                titulo = demanda.Titulo,
                tipo = 0,
                importancia = 2,
                situacao = 2
            });
        Assert.Equal(HttpStatusCode.OK, conclusao.StatusCode);

        var response = await client.PostAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}/tarefas",
            new { titulo = "Tarefa bloqueada" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    private sealed record HealthResponse(string Status);

    private sealed record ProblemDetailsResponse(string Title, string? Detail, int? Status);

    private sealed record DemandaAcademicaResponse(int Id, string Titulo);
}