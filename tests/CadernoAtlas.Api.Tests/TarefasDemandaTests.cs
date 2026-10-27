using System.Net;
using System.Net.Http.Json;
using CadernoAtlas.Api.Contracts.DemandasAcademicas;
using CadernoAtlas.Api.Contracts.TarefasDemanda;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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
    public async Task PutTarefa_MudaOrdem_ReposicionaOutrasTarefas()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);
        var rota = $"/api/demandas-academicas/{demanda.Id}/tarefas";

        foreach (var titulo in new[] { "Primeira etapa", "Segunda etapa", "Terceira etapa" })
        {
            var response = await client.PostAsJsonAsync(
                rota,
                new CriarTarefaDemandaRequest { Titulo = titulo });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }

        var tarefasAntes = await (await client.GetAsync(rota)).Content
            .ReadFromJsonAsync<List<TarefaDemandaResponse>>();
        Assert.NotNull(tarefasAntes);
        var primeira = Assert.Single(tarefasAntes.Where(tarefa => tarefa.Titulo == "Primeira etapa"));

        var atualizacao = await client.PutAsJsonAsync(
            $"{rota}/{primeira.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = primeira.Titulo,
                Ordem = 2,
                Situacao = primeira.Situacao
            });
        Assert.Equal(HttpStatusCode.OK, atualizacao.StatusCode);

        var tarefasDepois = await (await client.GetAsync(rota)).Content
            .ReadFromJsonAsync<List<TarefaDemandaResponse>>();
        Assert.NotNull(tarefasDepois);
        Assert.Equal(
            new[] { "Segunda etapa", "Terceira etapa", "Primeira etapa" },
            tarefasDepois.Select(tarefa => tarefa.Titulo).ToArray());
        Assert.Equal(new[] { 0, 1, 2 }, tarefasDepois.Select(tarefa => tarefa.Ordem).ToArray());
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
    public async Task DeleteTarefa_NormalizaOrdemDasTarefasRestantes()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);
        var rota = $"/api/demandas-academicas/{demanda.Id}/tarefas";

        var tarefa1 = await (await client.PostAsJsonAsync(rota, new CriarTarefaDemandaRequest { Titulo = "Tarefa 1" })).Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        var tarefa2 = await (await client.PostAsJsonAsync(rota, new CriarTarefaDemandaRequest { Titulo = "Tarefa 2" })).Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        var tarefa3 = await (await client.PostAsJsonAsync(rota, new CriarTarefaDemandaRequest { Titulo = "Tarefa 3" })).Content.ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(tarefa1);
        Assert.NotNull(tarefa2);
        Assert.NotNull(tarefa3);

        var exclusao = await client.DeleteAsync($"{rota}/{tarefa2.Id}");
        Assert.Equal(HttpStatusCode.NoContent, exclusao.StatusCode);

        var tarefasRestantes = await (await client.GetAsync(rota)).Content.ReadFromJsonAsync<List<TarefaDemandaResponse>>();
        Assert.NotNull(tarefasRestantes);
        Assert.Equal(2, tarefasRestantes.Count);
        Assert.Equal(0, tarefasRestantes[0].Ordem);
        Assert.Equal(1, tarefasRestantes[1].Ordem);
        Assert.Equal(tarefa1.Id, tarefasRestantes[0].Id);
        Assert.Equal(tarefa3.Id, tarefasRestantes[1].Id);
    }

    [Fact]
    public async Task PostTarefa_DemandaCancelada_RetornaConflict()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);

        var cancelamento = await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = demanda.Titulo,
                Situacao = SituacaoDemandaAcademica.Cancelada
            });

        Assert.Equal(HttpStatusCode.OK, cancelamento.StatusCode);

        var response = await client.PostAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}/tarefas",
            new CriarTarefaDemandaRequest
            {
                Titulo = "Nova tarefa"
            });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task PutTarefa_DemandaCancelada_RetornaConflict()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);
        var rota = $"/api/demandas-academicas/{demanda.Id}/tarefas";

        var criacao = await client.PostAsJsonAsync(
            rota,
            new CriarTarefaDemandaRequest { Titulo = "Tarefa existente" });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);

        await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = demanda.Titulo,
                Situacao = SituacaoDemandaAcademica.Cancelada
            });

        var response = await client.PutAsJsonAsync(
            $"{rota}/{criada.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = criada.Titulo,
                Ordem = criada.Ordem,
                Situacao = SituacaoTarefaDemanda.Pendente
            });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTarefa_DemandaCancelada_RetornaConflict()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);
        var rota = $"/api/demandas-academicas/{demanda.Id}/tarefas";

        var criacao = await client.PostAsJsonAsync(
            rota,
            new CriarTarefaDemandaRequest { Titulo = "Tarefa para exclusão" });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);

        await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = demanda.Titulo,
                Situacao = SituacaoDemandaAcademica.Cancelada
            });

        var exclusao = await client.DeleteAsync($"{rota}/{criada.Id}");
        Assert.Equal(HttpStatusCode.Conflict, exclusao.StatusCode);

        var consulta = await client.GetAsync($"{rota}/{criada.Id}");
        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);
    }

    [Fact]
    public async Task PostTarefa_DemandaEmAndamento_Permitida()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);

        await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = demanda.Titulo,
                Situacao = SituacaoDemandaAcademica.EmAndamento
            });

        var response = await client.PostAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Nova tarefa" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task PutTarefa_DemandaEmAndamento_Permitida()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);
        var rota = $"/api/demandas-academicas/{demanda.Id}/tarefas";

        var criacao = await client.PostAsJsonAsync(rota, new CriarTarefaDemandaRequest { Titulo = "Tarefa" });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);

        await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = demanda.Titulo,
                Situacao = SituacaoDemandaAcademica.EmAndamento
            });

        var response = await client.PutAsJsonAsync(
            $"{rota}/{criada.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = criada.Titulo,
                Ordem = criada.Ordem,
                Situacao = SituacaoTarefaDemanda.Concluida
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTarefa_DemandaEmAndamento_Permitida()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);
        var rota = $"/api/demandas-academicas/{demanda.Id}/tarefas";

        var criacao = await client.PostAsJsonAsync(rota, new CriarTarefaDemandaRequest { Titulo = "Tarefa" });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);

        await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = demanda.Titulo,
                Situacao = SituacaoDemandaAcademica.EmAndamento
            });

        var exclusao = await client.DeleteAsync($"{rota}/{criada.Id}");
        Assert.Equal(HttpStatusCode.NoContent, exclusao.StatusCode);
    }

    [Fact]
    public async Task PostTarefa_Rejeitada_DemandaConcluida_NaoPersisteAlteracoes()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);

        await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = demanda.Titulo,
                Situacao = SituacaoDemandaAcademica.Concluida
            });

        var response = await client.PostAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Tarefa não permitida" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var tarefas = await (await client.GetAsync($"/api/demandas-academicas/{demanda.Id}/tarefas")).Content.ReadFromJsonAsync<List<TarefaDemandaResponse>>();
        Assert.NotNull(tarefas);
        Assert.Empty(tarefas);
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

    [Fact]
    public async Task PostTarefa_ComEstimativaValida_CriaERetornaEstimativa()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);

        var response = await client.PostAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}/tarefas",
            new CriarTarefaDemandaRequest
            {
                Titulo = "Revisar SQL",
                Descricao = "Praticar consultas",
                EsforcoEstimadoMinutos = 45
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var criada = await response.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(criada);
        Assert.True(criada.Id > 0);
        Assert.Equal(45, criada.EsforcoEstimadoMinutos);

        var consulta = await client.GetAsync(
            $"/api/demandas-academicas/{demanda.Id}/tarefas/{criada.Id}");

        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);

        var recuperada = await consulta.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(recuperada);
        Assert.Equal(45, recuperada.EsforcoEstimadoMinutos);
    }

    [Fact]
    public async Task PutTarefa_ComEstimativaValida_AtualizaERetornaEstimativa()
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
                Titulo = "Revisar normalização",
                EsforcoEstimadoMinutos = 30
            });

        var criada = await criacao.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(criada);
        Assert.Equal(30, criada.EsforcoEstimadoMinutos);

        var atualizacao = await client.PutAsJsonAsync(
            $"{rota}/{criada.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = criada.Titulo,
                Ordem = criada.Ordem,
                EsforcoEstimadoMinutos = 60,
                Situacao = SituacaoTarefaDemanda.Pendente
            });

        Assert.Equal(HttpStatusCode.OK, atualizacao.StatusCode);

        var atualizada = await atualizacao.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(atualizada);
        Assert.Equal(60, atualizada.EsforcoEstimadoMinutos);

        var consulta = await client.GetAsync(
            $"{rota}/{criada.Id}");

        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);

        var recuperada = await consulta.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(recuperada);
        Assert.Equal(60, recuperada.EsforcoEstimadoMinutos);
    }

    [Fact]
    public async Task PostTarefa_ComEsforcoNegativo_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);

        var response = await client.PostAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}/tarefas",
            new CriarTarefaDemandaRequest
            {
                Titulo = "Tarefa teste",
                EsforcoEstimadoMinutos = -10
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutTarefa_ComEsforcoNegativo_RetornaBadRequest()
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
                Titulo = "Tarefa teste"
            });

        var criada = await criacao.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(criada);

        var response = await client.PutAsJsonAsync(
            $"{rota}/{criada.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = criada.Titulo,
                Ordem = criada.Ordem,
                EsforcoEstimadoMinutos = -5,
                Situacao = SituacaoTarefaDemanda.Pendente
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostTarefa_ComEsforcoZero_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var demanda = await CriarDemandaAsync(client);

        var response = await client.PostAsJsonAsync(
            $"/api/demandas-academicas/{demanda.Id}/tarefas",
            new CriarTarefaDemandaRequest
            {
                Titulo = "Tarefa teste",
                EsforcoEstimadoMinutos = 0
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutTarefa_ComEsforcoZero_RetornaBadRequest()
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
                Titulo = "Tarefa teste",
                EsforcoEstimadoMinutos = 30
            });

        var criada = await criacao.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(criada);

        var response = await client.PutAsJsonAsync(
            $"{rota}/{criada.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = criada.Titulo,
                Ordem = criada.Ordem,
                EsforcoEstimadoMinutos = 0,
                Situacao = SituacaoTarefaDemanda.Pendente
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutTarefa_ComEsforcoNulo_AtualizaEPersisteNull()
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
                Titulo = "Tarefa com estimativa",
                EsforcoEstimadoMinutos = 45
            });

        var criada = await criacao.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(criada);
        Assert.Equal(45, criada.EsforcoEstimadoMinutos);

        var atualizacao = await client.PutAsJsonAsync(
            $"{rota}/{criada.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = criada.Titulo,
                Ordem = criada.Ordem,
                EsforcoEstimadoMinutos = null,
                Situacao = SituacaoTarefaDemanda.Pendente
            });

        Assert.Equal(HttpStatusCode.OK, atualizacao.StatusCode);

        var atualizada = await atualizacao.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(atualizada);
        Assert.Null(atualizada.EsforcoEstimadoMinutos);

        var consulta = await client.GetAsync(
            $"{rota}/{criada.Id}");

        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);

        var recuperada = await consulta.Content
            .ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(recuperada);
        Assert.Null(recuperada.EsforcoEstimadoMinutos);
    }

    // Valida a check constraint de persistência usando o provedor SQLite da suíte de testes.
    // Não substitui o teste de integração contra PostgreSQL real.
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task TarefaDemanda_ConstraintSQLite_RejeitaEsforcoMenorOuIgualAZero(
        int esforcoEstimadoMinutos)
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var demanda = new DemandaAcademica
        {
            Titulo = "Demanda para teste de constraint"
        };
        dbContext.DemandasAcademicas.Add(demanda);
        await dbContext.SaveChangesAsync();

        var tarefaInvalida = new TarefaDemanda
        {
            DemandaAcademicaId = demanda.Id,
            Titulo = "Tarefa com esforço inválido",
            EsforcoEstimadoMinutos = esforcoEstimadoMinutos
        };

        dbContext.TarefasDemanda.Add(tarefaInvalida);

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
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