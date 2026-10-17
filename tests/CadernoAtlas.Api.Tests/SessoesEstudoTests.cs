
using System.Net;
using System.Net.Http.Json;
using CadernoAtlas.Api.Contracts.SessoesEstudo;
using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Tests;

public class SessoesEstudoTests
{
    [Fact]
    public async Task CancelarSessaoPlanejada_MarcaComoCancelada()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var criacao = await client.PostAsJsonAsync(
            "/api/sessoes-estudo", CriarRequest());

        var criada = await criacao.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(criada);

        var resposta = await client.PostAsync(
            $"/api/sessoes-estudo/{criada.Id}/cancelar", null);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var cancelada = await resposta.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(cancelada);
        Assert.Equal(SituacaoSessaoEstudo.Cancelada, cancelada.Situacao);
        Assert.NotNull(cancelada.CanceladaEm);
        Assert.Null(cancelada.DuracaoRealMinutos);
    }

    [Fact]
    public async Task CancelarSessaoEmAndamento_RegistraDuracaoReal()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var criacao = await client.PostAsJsonAsync(
            "/api/sessoes-estudo", CriarRequest());

        var criada = await criacao.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(criada);

        var inicio = await client.PostAsync(
            $"/api/sessoes-estudo/{criada.Id}/iniciar", null);

        Assert.Equal(HttpStatusCode.OK, inicio.StatusCode);

        var cancelamento = await client.PostAsync(
            $"/api/sessoes-estudo/{criada.Id}/cancelar", null);

        Assert.Equal(HttpStatusCode.OK, cancelamento.StatusCode);

        var cancelada = await cancelamento.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(cancelada);
        Assert.Equal(SituacaoSessaoEstudo.Cancelada, cancelada.Situacao);
        Assert.NotNull(cancelada.CanceladaEm);
        Assert.NotNull(cancelada.DuracaoRealMinutos);
        Assert.True(cancelada.DuracaoRealMinutos >= 0);
    }

    [Fact]
    public async Task IniciarSessaoInexistente_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var resposta = await client.PostAsync(
            "/api/sessoes-estudo/999/iniciar", null);

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [Fact]
    public async Task IniciarSessaoDuasVezes_RetornaConflictNaSegundaTentativa()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var criacao = await client.PostAsJsonAsync(
            "/api/sessoes-estudo", CriarRequest());

        var criada = await criacao.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(criada);

        var primeiraTentativa = await client.PostAsync(
            $"/api/sessoes-estudo/{criada.Id}/iniciar", null);

        Assert.Equal(HttpStatusCode.OK, primeiraTentativa.StatusCode);

        var segundaTentativa = await client.PostAsync(
            $"/api/sessoes-estudo/{criada.Id}/iniciar", null);

        Assert.Equal(HttpStatusCode.Conflict, segundaTentativa.StatusCode);
    }
    
    [Fact]
    public async Task ListarSemFiltros_RetornaTodasAsSessoesOrdenadasPorDataEHora()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 12),
            "Sessão B");

        await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 10),
            "Sessão C",
            new TimeOnly(15, 0));

        await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 10),
            "Sessão A",
            new TimeOnly(13, 0));

        var resposta = await client.GetAsync("/api/sessoes-estudo");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var sessoes = await resposta.Content
            .ReadFromJsonAsync<List<SessaoEstudoResponse>>();

        Assert.NotNull(sessoes);

        Assert.Equal(
            new[] { "Sessão A", "Sessão C", "Sessão B" },
            sessoes.Select(sessao => sessao.Titulo));
    }

    [Fact]
    public async Task ListarComPeriodo_FiltraPelasDatasDeFormaInclusiva()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 9),
            "Antes do período");

        await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 10),
            "Primeiro dia");

        await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 12),
            "Dentro do período");

        await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 15),
            "Último dia");

        await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 16),
            "Depois do período");

        var resposta = await client.GetAsync(
            "/api/sessoes-estudo?dataDe=2026-11-10&dataAte=2026-11-15");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var sessoes = await resposta.Content
            .ReadFromJsonAsync<List<SessaoEstudoResponse>>();

        Assert.NotNull(sessoes);

        Assert.Equal(
            new[]
            {
                new DateOnly(2026, 11, 10),
                new DateOnly(2026, 11, 12),
                new DateOnly(2026, 11, 15)
            },
            sessoes.Select(sessao => sessao.DataPlanejada));
    }

    [Fact]
    public async Task ListarPorSituacao_RetornaSomenteSessoesDaSituacaoInformada()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 10),
            "Sessão planejada");

        var sessaoEmAndamento = await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 11),
            "Sessão em andamento");

        var inicio = await client.PostAsync(
            $"/api/sessoes-estudo/{sessaoEmAndamento.Id}/iniciar",
            content: null);

        Assert.Equal(HttpStatusCode.OK, inicio.StatusCode);

        var resposta = await client.GetAsync(
            "/api/sessoes-estudo?situacao=EmAndamento");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var sessoes = await resposta.Content
            .ReadFromJsonAsync<List<SessaoEstudoResponse>>();

        Assert.NotNull(sessoes);

        var sessao = Assert.Single(sessoes);

        Assert.Equal(sessaoEmAndamento.Id, sessao.Id);
        Assert.Equal(SituacaoSessaoEstudo.EmAndamento, sessao.Situacao);
    }

    [Fact]
    public async Task ListarComPeriodoESituacao_AplicaOsDoisFiltros()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var sessaoEsperada = await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 12),
            "Planejada dentro do período");

        var sessaoEmAndamento = await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 13),
            "Em andamento dentro do período");

        await CriarSessaoAsync(
            client,
            new DateOnly(2026, 11, 9),
            "Planejada fora do período");

        var inicio = await client.PostAsync(
            $"/api/sessoes-estudo/{sessaoEmAndamento.Id}/iniciar",
            content: null);

        Assert.Equal(HttpStatusCode.OK, inicio.StatusCode);

        var resposta = await client.GetAsync(
            "/api/sessoes-estudo?dataDe=2026-11-10&dataAte=2026-11-15&situacao=Planejada");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var sessoes = await resposta.Content
            .ReadFromJsonAsync<List<SessaoEstudoResponse>>();

        Assert.NotNull(sessoes);

        var sessao = Assert.Single(sessoes);

        Assert.Equal(sessaoEsperada.Id, sessao.Id);
        Assert.Equal(SituacaoSessaoEstudo.Planejada, sessao.Situacao);
    }

    private static async Task<SessaoEstudoResponse> CriarSessaoAsync(
        HttpClient client,
        DateOnly dataPlanejada,
        string titulo,
        TimeOnly? horaInicio = null)
        {
            var request = new CriarSessaoEstudoRequest
            {
                Titulo = titulo,
                DataPlanejada = dataPlanejada,
                HoraInicioPlanejada = horaInicio ?? new TimeOnly(14, 0),
                DuracaoPlanejadaMinutos = 60
            };

            var resposta = await client.PostAsJsonAsync(
                "/api/sessoes-estudo",
                request);

            Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);

            var sessao = await resposta.Content
                .ReadFromJsonAsync<SessaoEstudoResponse>();

            Assert.NotNull(sessao);

            return sessao;
        }

    private static CriarSessaoEstudoRequest CriarRequest()
    {
        return new CriarSessaoEstudoRequest
        {
            Titulo = "Revisar normalização de bancos",
            DataPlanejada = new DateOnly(2026, 11, 10),
            HoraInicioPlanejada = new TimeOnly(14, 0),
            DuracaoPlanejadaMinutos = 60,
            Observacoes = "Revisar as formas normais."
        };
    }

    [Fact]
    public async Task PostSessao_ComDadosValidos_CriaESessaoPodeSerConsultada()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/sessoes-estudo",
            CriarRequest());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var criada = await response.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(criada);
        Assert.True(criada.Id > 0);
        Assert.Equal(
            "Revisar normalização de bancos",
            criada.Titulo);
        Assert.Equal(
            SituacaoSessaoEstudo.Planejada,
            criada.Situacao);
        Assert.Equal(60, criada.DuracaoPlanejadaMinutos);
        Assert.Null(criada.InicioRealEm);
        Assert.Null(criada.ConcluidaEm);
        Assert.NotNull(response.Headers.Location);

        var consulta = await client.GetAsync(
            $"/api/sessoes-estudo/{criada.Id}");

        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);

        var recuperada = await consulta.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(recuperada);
        Assert.Equal(criada.Id, recuperada.Id);
        Assert.Equal(criada.Titulo, recuperada.Titulo);
    }

    [Fact]
    public async Task PostSessao_ComDemandaETarefa_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new CriarSessaoEstudoRequest
        {
            Titulo = "Estudar para a prova",
            DataPlanejada = new DateOnly(2026, 11, 10),
            HoraInicioPlanejada = new TimeOnly(14, 0),
            DuracaoPlanejadaMinutos = 60,
            DemandaAcademicaId = 1,
            TarefaDemandaId = 1
        };

        var response = await client.PostAsJsonAsync(
            "/api/sessoes-estudo",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostSessao_ComDemandaInexistente_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new CriarSessaoEstudoRequest
        {
            Titulo = "Revisar normalização de bancos",
            DataPlanejada = new DateOnly(2026, 11, 10),
            HoraInicioPlanejada = new TimeOnly(14, 0),
            DuracaoPlanejadaMinutos = 60,
            DemandaAcademicaId = 999
        };

        var response = await client.PostAsJsonAsync(
            "/api/sessoes-estudo",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task IniciarEConcluirSessao_AtualizaSituacaoERegistraDuracao()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var criacao = await client.PostAsJsonAsync(
            "/api/sessoes-estudo",
            CriarRequest());

        Assert.Equal(HttpStatusCode.Created, criacao.StatusCode);

        var criada = await criacao.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(criada);

        var inicio = await client.PostAsync(
            $"/api/sessoes-estudo/{criada.Id}/iniciar",
            content: null);

        Assert.Equal(HttpStatusCode.OK, inicio.StatusCode);

        var emAndamento = await inicio.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(emAndamento);
        Assert.Equal(
            SituacaoSessaoEstudo.EmAndamento,
            emAndamento.Situacao);
        Assert.NotNull(emAndamento.InicioRealEm);

        var conclusao = await client.PostAsync(
            $"/api/sessoes-estudo/{criada.Id}/concluir",
            content: null);

        Assert.Equal(HttpStatusCode.OK, conclusao.StatusCode);

        var concluida = await conclusao.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(concluida);
        Assert.Equal(
            SituacaoSessaoEstudo.Concluida,
            concluida.Situacao);
        Assert.NotNull(concluida.ConcluidaEm);
        Assert.NotNull(concluida.DuracaoRealMinutos);
        Assert.True(concluida.DuracaoRealMinutos >= 0);
    }

    [Fact]
    public async Task SessaoEmAndamento_NaoPodeSerEditadaNemExcluida()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var criacao = await client.PostAsJsonAsync(
            "/api/sessoes-estudo",
            CriarRequest());

        var criada = await criacao.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(criada);

        var inicio = await client.PostAsync(
            $"/api/sessoes-estudo/{criada.Id}/iniciar",
            content: null);

        Assert.Equal(HttpStatusCode.OK, inicio.StatusCode);

        var atualizacao = await client.PutAsJsonAsync(
            $"/api/sessoes-estudo/{criada.Id}",
            new AtualizarSessaoEstudoRequest
            {
                Titulo = "Novo título",
                DataPlanejada = new DateOnly(2026, 11, 11),
                HoraInicioPlanejada = new TimeOnly(15, 0),
                DuracaoPlanejadaMinutos = 90
            });

        Assert.Equal(HttpStatusCode.Conflict, atualizacao.StatusCode);

        var exclusao = await client.DeleteAsync(
            $"/api/sessoes-estudo/{criada.Id}");

        Assert.Equal(HttpStatusCode.Conflict, exclusao.StatusCode);
    }

    [Fact]
    public async Task ConcluirSessaoPlanejada_RetornaConflict()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var criacao = await client.PostAsJsonAsync(
            "/api/sessoes-estudo",
            CriarRequest());

        var criada = await criacao.Content
            .ReadFromJsonAsync<SessaoEstudoResponse>();

        Assert.NotNull(criada);

        var conclusao = await client.PostAsync(
            $"/api/sessoes-estudo/{criada.Id}/concluir",
            content: null);

        Assert.Equal(HttpStatusCode.Conflict, conclusao.StatusCode);
    }
}
