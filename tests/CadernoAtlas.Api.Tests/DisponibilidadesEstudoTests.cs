using System.Net;
using System.Net.Http.Json;
using CadernoAtlas.Api.Contracts.DisponibilidadesEstudo;

namespace CadernoAtlas.Api.Tests;

public class DisponibilidadesEstudoTests
{
    [Fact]
    public async Task PostDisponibilidade_ComDadosValidos_RetornaCreated()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var resposta = await CriarDisponibilidadeAsync(
            client,
            new DateOnly(2026, 11, 10),
            new TimeOnly(9, 0),
            new TimeOnly(11, 0));

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);

        var disponibilidade = await resposta.Content
            .ReadFromJsonAsync<DisponibilidadeEstudoResponse>();

        Assert.NotNull(disponibilidade);
        Assert.True(disponibilidade.Id > 0);
        Assert.Equal(new DateOnly(2026, 11, 10), disponibilidade.Data);
        Assert.Equal(new TimeOnly(9, 0), disponibilidade.HoraInicio);
        Assert.Equal(new TimeOnly(11, 0), disponibilidade.HoraFim);
    }

    [Fact]
    public async Task GetDisponibilidades_ComPeriodo_FiltraDatasInclusivasEOrdena()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        await CriarDisponibilidadeValidaAsync(
            client, new DateOnly(2026, 11, 12));

        await CriarDisponibilidadeValidaAsync(
            client, new DateOnly(2026, 11, 10));

        await CriarDisponibilidadeValidaAsync(
            client, new DateOnly(2026, 11, 15));

        await CriarDisponibilidadeValidaAsync(
            client, new DateOnly(2026, 11, 9));

        await CriarDisponibilidadeValidaAsync(
            client, new DateOnly(2026, 11, 16));

        var resposta = await client.GetAsync(
            "/api/disponibilidades-estudo?dataDe=2026-11-10&dataAte=2026-11-15");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var disponibilidades = await resposta.Content
            .ReadFromJsonAsync<List<DisponibilidadeEstudoResponse>>();

        Assert.NotNull(disponibilidades);

        Assert.Equal(
            new[]
            {
                new DateOnly(2026, 11, 10),
                new DateOnly(2026, 11, 12),
                new DateOnly(2026, 11, 15)
            },
            disponibilidades.Select(item => item.Data));
    }

    [Fact]
    public async Task PostDisponibilidade_ComSobreposicao_RetornaConflict()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var primeira = await CriarDisponibilidadeAsync(
            client,
            new DateOnly(2026, 11, 10),
            new TimeOnly(9, 0),
            new TimeOnly(10, 0));

        Assert.Equal(HttpStatusCode.Created, primeira.StatusCode);

        // Intervalos consecutivos são permitidos
        var consecutiva = await CriarDisponibilidadeAsync(
            client,
            new DateOnly(2026, 11, 10),
            new TimeOnly(10, 0),
            new TimeOnly(11, 0));

        Assert.Equal(HttpStatusCode.Created, consecutiva.StatusCode);

        // Este intervalo se sobrepõe à primeira disponibilidade
        var sobreposta = await CriarDisponibilidadeAsync(
            client,
            new DateOnly(2026, 11, 10),
            new TimeOnly(9, 30),
            new TimeOnly(10, 30));

        Assert.Equal(HttpStatusCode.Conflict, sobreposta.StatusCode);
    }

    [Fact]
    public async Task PostDisponibilidade_ComHorarioFinalInvalido_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var casos = new[]
        {
            (Inicio: new TimeOnly(14, 0), Fim: new TimeOnly(14, 0)),
            (Inicio: new TimeOnly(15, 0), Fim: new TimeOnly(14, 0))
        };

        foreach (var caso in casos)
        {
            var resposta = await CriarDisponibilidadeAsync(
                client,
                new DateOnly(2026, 11, 10),
                caso.Inicio,
                caso.Fim);

            Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        }
    }

    private static Task<HttpResponseMessage> CriarDisponibilidadeAsync(
        HttpClient client,
        DateOnly data,
        TimeOnly horaInicio,
        TimeOnly horaFim)
    {
        return client.PostAsJsonAsync(
            "/api/disponibilidades-estudo",
            new
            {
                Data = data,
                HoraInicio = horaInicio,
                HoraFim = horaFim
            });
    }

    private static async Task CriarDisponibilidadeValidaAsync(
        HttpClient client,
        DateOnly data)
    {
        var resposta = await CriarDisponibilidadeAsync(
            client,
            data,
            new TimeOnly(9, 0),
            new TimeOnly(11, 0));

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

}