using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using CadernoAtlas.Api.Contracts.DemandasAcademicas;
using CadernoAtlas.Api.Contracts.TarefasDemanda;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace CadernoAtlas.Api.Tests;

[Collection(PostgreSqlSessoesEstudoCollection.Nome)]
[Trait("Category", "PostgreSql")]
public sealed class PostgreSqlTarefasDemandaTests(
    PostgreSqlSessoesEstudoFixture fixture)
    : IAsyncLifetime
{
    private readonly HashSet<int> _demandasCriadas = [];

    private static string TituloUnico(string prefixo) => $"{prefixo} {Guid.NewGuid():N}";

    private async Task<int> CriarDemandaAsync(HttpClient client, string titulo)
    {
        var response = await client.PostAsJsonAsync("/api/demandas-academicas",
            new CriarDemandaAcademicaRequest { Titulo = titulo });
        var demanda = await response.Content.ReadFromJsonAsync<DemandaAcademicaResponse>();
        Assert.NotNull(demanda);
        _demandasCriadas.Add(demanda.Id);
        return demanda.Id;
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        if (_demandasCriadas.Count == 0)
        {
            return;
        }

        await using var dbContext = fixture.CreateDbContext();
        var demandas = await dbContext.DemandasAcademicas
            .Where(demanda => _demandasCriadas.Contains(demanda.Id))
            .ToListAsync();

        if (demandas.Count > 0)
        {
            dbContext.DemandasAcademicas.RemoveRange(demandas);
            await dbContext.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PostTarefa_ComEsforcoZero_RetornaBadRequest()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda teste"));

        var response = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest
            {
                Titulo = "Tarefa zero",
                EsforcoEstimadoMinutos = 0
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutTarefa_ComEsforcoZero_RetornaBadRequest()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda teste"));

        var criacao = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Tarefa inicial", EsforcoEstimadoMinutos = 30 });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);

        var response = await client.PutAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}",
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
    public async Task PutTarefa_ComEsforcoNegativo_RetornaBadRequest()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda teste"));

        var criacao = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Tarefa inicial" });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);

        var response = await client.PutAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}",
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
    public async Task PutTarefa_ComEsforcoNulo_AtualizaEPersisteNull()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda teste"));

        var criacao = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Tarefa com estimativa", EsforcoEstimadoMinutos = 45 });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);
        Assert.Equal(45, criada.EsforcoEstimadoMinutos);

        var atualizacao = await client.PutAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = criada.Titulo,
                Ordem = criada.Ordem,
                EsforcoEstimadoMinutos = null,
                Situacao = SituacaoTarefaDemanda.Pendente
            });

        Assert.Equal(HttpStatusCode.OK, atualizacao.StatusCode);

        var atualizada = await atualizacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(atualizada);
        Assert.Null(atualizada.EsforcoEstimadoMinutos);

        var consulta = await client.GetAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}");
        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);
        var recuperada = await consulta.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(recuperada);
        Assert.Null(recuperada.EsforcoEstimadoMinutos);
    }

    [Fact]
    public async Task ConstraintCK_TarefasDemanda_EsforcoNaoNegativo_RejeitaZeroNaPersistencia()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();

        var demanda = new DemandaAcademica
        {
            Titulo = TituloUnico("FK Tarefa"),
            EsforcoEstimadoMinutos = 60
        };
        dbContext.DemandasAcademicas.Add(demanda);
        await dbContext.SaveChangesAsync();

        var tarefa = new TarefaDemanda
        {
            DemandaAcademicaId = demanda.Id,
            Titulo = "Tarefa zero",
            Ordem = 0,
            EsforcoEstimadoMinutos = 0
        };
        dbContext.TarefasDemanda.Add(tarefa);

        var excecao = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
        var sqlState = ObterSqlState(excecao);
        Assert.Equal("23514", sqlState);
    }

    [Fact]
    public async Task ConstraintCK_TarefasDemanda_EsforcoNaoNegativo_RejeitaNegativoNaPersistencia()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();

        var demanda = new DemandaAcademica
        {
            Titulo = TituloUnico("FK Tarefa"),
            EsforcoEstimadoMinutos = 60
        };
        dbContext.DemandasAcademicas.Add(demanda);
        await dbContext.SaveChangesAsync();

        var tarefa = new TarefaDemanda
        {
            DemandaAcademicaId = demanda.Id,
            Titulo = "Tarefa negativa",
            Ordem = 0,
            EsforcoEstimadoMinutos = -10
        };
        dbContext.TarefasDemanda.Add(tarefa);

        var excecao = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
        var sqlState = ObterSqlState(excecao);
        Assert.Equal("23514", sqlState);
    }

    [Fact]
    public async Task ConstraintCK_TarefasDemanda_EsforcoNaoNegativo_PermiteNull()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();

        var demanda = new DemandaAcademica
        {
            Titulo = TituloUnico("FK Tarefa"),
            EsforcoEstimadoMinutos = 60
        };
        dbContext.DemandasAcademicas.Add(demanda);
        await dbContext.SaveChangesAsync();

        var tarefa = new TarefaDemanda
        {
            DemandaAcademicaId = demanda.Id,
            Titulo = "Tarefa null",
            Ordem = 0,
            EsforcoEstimadoMinutos = null
        };
        dbContext.TarefasDemanda.Add(tarefa);
        await dbContext.SaveChangesAsync();

        Assert.True(tarefa.Id > 0);
    }

    [Fact]
    public async Task ConstraintCK_TarefasDemanda_OrdemNaoNegativa_RejeitaNegativo()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();

        var demanda = new DemandaAcademica
        {
            Titulo = TituloUnico("FK Tarefa"),
            EsforcoEstimadoMinutos = 60
        };
        dbContext.DemandasAcademicas.Add(demanda);
        await dbContext.SaveChangesAsync();

        var tarefa = new TarefaDemanda
        {
            DemandaAcademicaId = demanda.Id,
            Titulo = "Tarefa ordem negativa",
            Ordem = -1,
            EsforcoEstimadoMinutos = 30
        };
        dbContext.TarefasDemanda.Add(tarefa);

        var excecao = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
        var sqlState = ObterSqlState(excecao);
        Assert.Equal("23514", sqlState);
    }

    [Fact]
    public async Task ConstraintCK_TarefasDemanda_OrdemNaoNegativa_PermiteZeroEPositivo()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();

        var demanda = new DemandaAcademica
        {
            Titulo = TituloUnico("FK Tarefa"),
            EsforcoEstimadoMinutos = 60
        };
        dbContext.DemandasAcademicas.Add(demanda);
        await dbContext.SaveChangesAsync();

        var tarefa1 = new TarefaDemanda
        {
            DemandaAcademicaId = demanda.Id,
            Titulo = "Tarefa ordem zero",
            Ordem = 0,
            EsforcoEstimadoMinutos = 30
        };
        var tarefa2 = new TarefaDemanda
        {
            DemandaAcademicaId = demanda.Id,
            Titulo = "Tarefa ordem cinco",
            Ordem = 5,
            EsforcoEstimadoMinutos = 30
        };
        dbContext.TarefasDemanda.AddRange(tarefa1, tarefa2);
        await dbContext.SaveChangesAsync();

        Assert.True(tarefa1.Id > 0);
        Assert.True(tarefa2.Id > 0);
    }

    [Fact]
    public async Task FK_TarefaDemanda_DemandaAcademicaId_CascadeDelete()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();

        var demanda = new DemandaAcademica
        {
            Titulo = TituloUnico("Cascade delete tarefas"),
            EsforcoEstimadoMinutos = 60
        };
        dbContext.DemandasAcademicas.Add(demanda);
        await dbContext.SaveChangesAsync();

        var tarefa1 = new TarefaDemanda
        {
            DemandaAcademicaId = demanda.Id,
            Titulo = "Tarefa 1",
            Ordem = 0
        };
        var tarefa2 = new TarefaDemanda
        {
            DemandaAcademicaId = demanda.Id,
            Titulo = "Tarefa 2",
            Ordem = 1
        };
        dbContext.TarefasDemanda.AddRange(tarefa1, tarefa2);
        await dbContext.SaveChangesAsync();

        var tarefasAntes = await dbContext.TarefasDemanda.CountAsync(t => t.DemandaAcademicaId == demanda.Id);
        Assert.Equal(2, tarefasAntes);

        dbContext.DemandasAcademicas.Remove(demanda);
        await dbContext.SaveChangesAsync();

        var tarefasDepois = await dbContext.TarefasDemanda.CountAsync(t => t.DemandaAcademicaId == demanda.Id);
        Assert.Equal(0, tarefasDepois);
    }

    [Fact]
    public async Task FK_TarefaDemanda_DemandaAcademicaId_RejeitaDemandaInexistente()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();

        var tarefa = new TarefaDemanda
        {
            DemandaAcademicaId = 999999,
            Titulo = "Tarefa órfã",
            Ordem = 0,
            EsforcoEstimadoMinutos = 30
        };
        dbContext.TarefasDemanda.Add(tarefa);

        var excecao = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
        var sqlState = ObterSqlState(excecao);
        Assert.Equal("23503", sqlState); // foreign_key_violation
    }

    [Fact]
    public async Task FK_SessaoEstudo_TarefaDemandaId_SetNull_QuandoTarefaExcluida()
    {
        await using var dbContext = fixture.CreateDbContext();
        await using var transacao = await dbContext.Database.BeginTransactionAsync();

        var demanda = new DemandaAcademica
        {
            Titulo = TituloUnico("FK SetNull tarefa"),
            EsforcoEstimadoMinutos = 60
        };
        dbContext.DemandasAcademicas.Add(demanda);
        await dbContext.SaveChangesAsync();

        var tarefa = new TarefaDemanda
        {
            DemandaAcademicaId = demanda.Id,
            Titulo = "Tarefa vinculada",
            Ordem = 0
        };
        dbContext.TarefasDemanda.Add(tarefa);
        await dbContext.SaveChangesAsync();

        var sessao = new SessaoEstudo
        {
            Titulo = "Sessão vinculada à tarefa",
            DataPlanejada = new DateOnly(2030, 1, 15),
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Planejada,
            TarefaDemandaId = tarefa.Id
        };
        dbContext.SessoesEstudo.Add(sessao);
        await dbContext.SaveChangesAsync();

        var sessaoId = sessao.Id;
        dbContext.TarefasDemanda.Remove(tarefa);
        await dbContext.SaveChangesAsync();

        var sessaoAtualizada = await dbContext.SessoesEstudo.FindAsync(sessaoId);
        Assert.NotNull(sessaoAtualizada);
        Assert.Null(sessaoAtualizada.TarefaDemandaId);
    }

    [Fact]
    public async Task PostTarefa_DemandaConcluida_RetornaConflict()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda concluída"));

        await client.PutAsJsonAsync($"/api/demandas-academicas/{demandaId}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = TituloUnico("Demanda concluída"),
                Situacao = SituacaoDemandaAcademica.Concluida
            });

        var response = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Nova tarefa" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var problema = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problema);
        Assert.Equal("A demanda não permite alterações.", problema.Title);
    }

    [Fact]
    public async Task PutTarefa_DemandaConcluida_ReabrirTarefa_RetornaConflict()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var tituloDemanda = TituloUnico("Demanda concluída");
        var demandaId = await CriarDemandaAsync(client, tituloDemanda);

        var criacao = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Tarefa existente" });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);

        await client.PutAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = criada.Titulo,
                Ordem = criada.Ordem,
                Situacao = SituacaoTarefaDemanda.Concluida
            });

        await client.PutAsJsonAsync($"/api/demandas-academicas/{demandaId}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = tituloDemanda,
                Situacao = SituacaoDemandaAcademica.Concluida
            });

        var response = await client.PutAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = criada.Titulo,
                Ordem = criada.Ordem,
                Situacao = SituacaoTarefaDemanda.Pendente
            });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var problema = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problema);
        Assert.Equal("A demanda não permite alterações.", problema.Title);
    }

    [Fact]
    public async Task DeleteTarefa_Existente_RetornaNoContent()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda para exclusão"));

        var criacao = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Tarefa temporária" });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);

        var exclusao = await client.DeleteAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}");
        Assert.Equal(HttpStatusCode.NoContent, exclusao.StatusCode);

        var consulta = await client.GetAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}");
        Assert.Equal(HttpStatusCode.NotFound, consulta.StatusCode);
    }

    [Fact]
    public async Task GetTarefas_OrdenacaoPorOrdemEId()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda ordenação"));

        await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Segunda etapa" });
        await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Primeira etapa" });
        await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Terceira etapa" });

        var response = await client.GetAsync($"/api/demandas-academicas/{demandaId}/tarefas");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var tarefas = await response.Content.ReadFromJsonAsync<List<TarefaDemandaResponse>>();
        Assert.NotNull(tarefas);
        Assert.Equal(3, tarefas.Count);
        Assert.Equal(0, tarefas[0].Ordem);
        Assert.Equal(1, tarefas[1].Ordem);
        Assert.Equal(2, tarefas[2].Ordem);
    }

    [Fact]
    public async Task GetTarefas_DemandaInexistente_RetornaNotFound()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/demandas-academicas/999999/tarefas");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostTarefa_TituloInvalido_RetornaBadRequest()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda teste"));

        var response = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = " " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostTarefa_ComEstimativaValida_CriaERetornaEstimativa()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda teste"));

        var response = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest
            {
                Titulo = "Revisar SQL",
                Descricao = "Praticar consultas",
                EsforcoEstimadoMinutos = 45
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var criada = await response.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);
        Assert.Equal(45, criada.EsforcoEstimadoMinutos);

        var consulta = await client.GetAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}");
        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);
        var recuperada = await consulta.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(recuperada);
        Assert.Equal(45, recuperada.EsforcoEstimadoMinutos);
    }

    [Fact]
    public async Task DeleteTarefa_NormalizaOrdemDasTarefasRestantes()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda exclusão ordem"));

        var rota = $"/api/demandas-academicas/{demandaId}/tarefas";

        var t1 = await (await client.PostAsJsonAsync(rota, new CriarTarefaDemandaRequest { Titulo = "Tarefa 1" })).Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        var t2 = await (await client.PostAsJsonAsync(rota, new CriarTarefaDemandaRequest { Titulo = "Tarefa 2" })).Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        var t3 = await (await client.PostAsJsonAsync(rota, new CriarTarefaDemandaRequest { Titulo = "Tarefa 3" })).Content.ReadFromJsonAsync<TarefaDemandaResponse>();

        Assert.NotNull(t1);
        Assert.NotNull(t2);
        Assert.NotNull(t3);

        var exclusao = await client.DeleteAsync($"{rota}/{t2.Id}");
        Assert.Equal(HttpStatusCode.NoContent, exclusao.StatusCode);

        var tarefasRestantes = await (await client.GetAsync(rota)).Content.ReadFromJsonAsync<List<TarefaDemandaResponse>>();
        Assert.NotNull(tarefasRestantes);
        Assert.Equal(2, tarefasRestantes.Count);
        Assert.Equal(0, tarefasRestantes[0].Ordem);
        Assert.Equal(1, tarefasRestantes[1].Ordem);
        Assert.Equal(t1.Id, tarefasRestantes[0].Id);
        Assert.Equal(t3.Id, tarefasRestantes[1].Id);
    }

    [Fact]
    public async Task DeleteTarefa_DemandaConcluida_RetornaConflict()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda concluída"));

        var criacao = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Tarefa para exclusão" });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);

        // Primeiro conclui a tarefa
        var atualizacaoTarefa = await client.PutAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}",
            new AtualizarTarefaDemandaRequest
            {
                Titulo = criada.Titulo,
                Ordem = criada.Ordem,
                Situacao = SituacaoTarefaDemanda.Concluida
            });
        Assert.Equal(HttpStatusCode.OK, atualizacaoTarefa.StatusCode);

        // Depois conclui a demanda
        var atualizacaoDemanda = await client.PutAsJsonAsync($"/api/demandas-academicas/{demandaId}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = TituloUnico("Demanda concluída"),
                Situacao = SituacaoDemandaAcademica.Concluida
            });
        Assert.Equal(HttpStatusCode.OK, atualizacaoDemanda.StatusCode);

        var exclusao = await client.DeleteAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}");
        Assert.Equal(HttpStatusCode.Conflict, exclusao.StatusCode);

        var consulta = await client.GetAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}");
        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);
    }

    [Fact]
    public async Task DeleteTarefa_DemandaCancelada_RetornaConflict()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda cancelada"));

        var criacao = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Tarefa para exclusão" });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);

        var atualizacaoDemanda = await client.PutAsJsonAsync($"/api/demandas-academicas/{demandaId}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = TituloUnico("Demanda cancelada"),
                Situacao = SituacaoDemandaAcademica.Cancelada
            });
        Assert.Equal(HttpStatusCode.OK, atualizacaoDemanda.StatusCode);

        var exclusao = await client.DeleteAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}");
        Assert.Equal(HttpStatusCode.Conflict, exclusao.StatusCode);

        var consulta = await client.GetAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}");
        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);
    }

    [Fact]
    public async Task DeleteTarefa_Rejeicao_NaoPersisteAlteracoes()
    {
        using var factory = new PostgreSqlWebApplicationFactory(fixture.ConnectionString);
        using var client = factory.CreateClient();

        var demandaId = await CriarDemandaAsync(client, TituloUnico("Demanda cancelada"));

        var criacao = await client.PostAsJsonAsync($"/api/demandas-academicas/{demandaId}/tarefas",
            new CriarTarefaDemandaRequest { Titulo = "Tarefa existente" });
        var criada = await criacao.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(criada);

        var atualizacaoDemanda = await client.PutAsJsonAsync($"/api/demandas-academicas/{demandaId}",
            new AtualizarDemandaAcademicaRequest
            {
                Titulo = TituloUnico("Demanda cancelada"),
                Situacao = SituacaoDemandaAcademica.Cancelada
            });
        Assert.Equal(HttpStatusCode.OK, atualizacaoDemanda.StatusCode);

        var exclusao = await client.DeleteAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}");
        Assert.Equal(HttpStatusCode.Conflict, exclusao.StatusCode);

        var consulta = await client.GetAsync($"/api/demandas-academicas/{demandaId}/tarefas/{criada.Id}");
        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);

        var tarefa = await consulta.Content.ReadFromJsonAsync<TarefaDemandaResponse>();
        Assert.NotNull(tarefa);
        Assert.Equal(criada.Id, tarefa.Id);
        Assert.Equal(criada.Titulo, tarefa.Titulo);
        Assert.Equal(criada.Ordem, tarefa.Ordem);
    }

    private static string? ObterSqlState(Exception excecao)
    {
        for (Exception? atual = excecao; atual is not null; atual = atual.InnerException)
        {
            if (atual is PostgresException pgEx)
            {
                return pgEx.SqlState;
            }
        }
        return null;
    }
}