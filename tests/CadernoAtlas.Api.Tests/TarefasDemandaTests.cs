using System.Net;
using System.Net.Http.Json;
using CadernoAtlas.Api.Contracts.DemandasAcademicas;
using CadernoAtlas.Api.Contracts.TarefasDemanda;
using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Tests;

public class TarefasDemandaTests
{
    [Fact]
    public async Task PostTarefa_ComDadosValidos_CriaTarefaPendente()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);

        var response = await client.PostAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}/tarefas",
            new CriarTarefaDemandaRequest
            {
                Titulo = "  Revisar SQL  ",
                Descricao = "Praticar consultas"
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var criada = await response.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(criada);
        Assert.True(criada.Id > 0);
        Assert.Equal(demanda.Id, criada.DemandaAcademicaId);
        Assert.Equal("Revisar SQL", criada.Titulo);
        Assert.Equal(0, criada.Ordem);
        Assert.Equal(
            SituacaoTarefaDemanda.Pendente,
            criada.Situacao);

        Assert.NotNull(response.Headers.Location);
    }

    [Fact]
    public async Task GetTarefas_RetornaTarefasNaOrdemDefinida()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);
        var rota = $"/api/demandas-academicas/{demanda.Id}/tarefas";

        await client.PostAsJsonAsync(
            rota,
            new CriarTarefaDemandaRequest
            {
                Titulo = "Segunda etapa"
            });

        await client.PostAsJsonAsync(
            rota,
            new CriarTarefaDemandaRequest
            {
                Titulo = "Primeira etapa"
            });

        var response = await client.GetAsync(rota);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var tarefas = await response.Content
            .ReadFromJsonAsync<List<TarefaDemandaResponse>>();

        Assert.NotNull(tarefas);
        Assert.Equal(2, tarefas.Count);
        Assert.Equal(0, tarefas[0].Ordem);
        Assert.Equal(1, tarefas[1].Ordem);
        Assert.Equal("Segunda etapa", tarefas[0].Titulo);
        Assert.Equal("Primeira etapa", tarefas[1].Titulo);
    }

    [Fact]
    public async Task PutTarefa_Concluida_PermiteConcluirDemanda()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);
        var rota = $"/api/demandas-academicas/{demanda.Id}/tarefas";

        var criacao = await client.PostAsJsonAsync(
            rota,
            new CriarTarefaDemandaRequest
            {
                Titulo = "Revisar normalização"
            });

        var criada = await criacao.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(criada);

        var atualizacaoTarefa = await client.PutAsJsonAsync(
            $"{rota}/{criada.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = criada.Titulo,
                Ordem = criada.Ordem,
                Situacao = SituacaoTarefaDemanda.Concluida
            });

        Assert.Equal(HttpStatusCode.OK, atualizacaoTarefa.StatusCode);

        var atualizacaoDemanda = await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = demanda.Titulo,
                Situacao = SituacaoDemandaAcademica.Concluida
            });

        Assert.Equal(HttpStatusCode.OK, atualizacaoDemanda.StatusCode);
    }

    [Fact]
    public async Task PostTarefa_DemandaConcluida_RetornaConflict()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);

        var conclusao = await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = demanda.Titulo,
                Situacao = SituacaoDemandaAcademica.Concluida
            });

        Assert.Equal(HttpStatusCode.OK, conclusao.StatusCode);

        var response = await client.PostAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}/tarefas",
            new CriarTarefaDemandaRequest
            {
                Titulo = "Nova tarefa"
            });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTarefa_Existente_RetornaNoContent()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);
        var rota = $"/api/demandas-academicas/{demanda.Id}/tarefas";

        var criacao = await client.PostAsJsonAsync(
            rota,
            new CriarTarefaDemandaRequest
            {
                Titulo = "Tarefa temporária"
            });

        var criada = await criacao.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(criada);

        var exclusao = await client.DeleteAsync(
            $"{rota}/{criada.Id}");

        Assert.Equal(HttpStatusCode.NoContent, exclusao.StatusCode);

        var consulta = await client.GetAsync(
            $"{rota}/{criada.Id}");

        Assert.Equal(HttpStatusCode.NotFound, consulta.StatusCode);
    }

    [Fact]
    public async Task PostTarefa_ComTituloInvalido_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);

        var response = await client.PostAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}/tarefas",
            new CriarTarefaDemandaRequest
            {
                Titulo = " "
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<DemandaAcademicaResponse> CriarDemandaAsync(
        HttpClient client)
    {
        var response = await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Demanda de teste"
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var demanda = await response.Content
            .ReadFromJsonAsync<DemandaAcademicaResponse>();

        Assert.NotNull(demanda);

        return demanda;
    }
}