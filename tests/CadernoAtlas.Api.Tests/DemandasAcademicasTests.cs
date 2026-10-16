using System.Net;
using System.Net.Http.Json;
using CadernoAtlas.Api.Contracts.DemandasAcademicas;
using CadernoAtlas.Api.Models;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace CadernoAtlas.Api.Tests;

public class DemandasAcademicasTests
{
    [Fact]
    public async Task GetDemandasPriorizadas_OrdenaPorUrgenciaEExcluiInativas()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var fusoHorario = factory.Services.GetRequiredService<TimeZoneInfo>();
        var hoje = PriorizadorDemandasAcademicas.ObterDataNoFuso(
            DateTime.UtcNow,
            fusoHorario);

        var demandasParaCriar = new[]
        {
            new DemandaAcademica
            {
                Titulo = "Prazo vencido",
                Prazo = hoje.AddDays(-2),
                Importancia = ImportanciaDemandaAcademica.Baixa
            },
            new DemandaAcademica
            {
                Titulo = "Vence hoje",
                Prazo = hoje,
                Importancia = ImportanciaDemandaAcademica.Baixa
            },
            new DemandaAcademica
            {
                Titulo = "Amanhã pendente alta",
                Prazo = hoje.AddDays(1),
                Importancia = ImportanciaDemandaAcademica.Alta,
                Situacao = SituacaoDemandaAcademica.Pendente
            },
            new DemandaAcademica
            {
                Titulo = "Amanhã em andamento alta",
                Prazo = hoje.AddDays(1),
                Importancia = ImportanciaDemandaAcademica.Alta,
                Situacao = SituacaoDemandaAcademica.EmAndamento
            },
            new DemandaAcademica
            {
                Titulo = "Amanhã baixa",
                Prazo = hoje.AddDays(1),
                Importancia = ImportanciaDemandaAcademica.Baixa
            },
            new DemandaAcademica
            {
                Titulo = "Prazo em 5 dias",
                Prazo = hoje.AddDays(5)
            },
            new DemandaAcademica
            {
                Titulo = "Prazo em 10 dias",
                Prazo = hoje.AddDays(10)
            },
            new DemandaAcademica
            {
                Titulo = "Prazo em 20 dias",
                Prazo = hoje.AddDays(20)
            },
            new DemandaAcademica
            {
                Titulo = "Sem prazo",
                Prazo = null,
                Importancia = ImportanciaDemandaAcademica.Alta
            },
            new DemandaAcademica
            {
                Titulo = "Concluída atrasada",
                Prazo = hoje.AddDays(-3),
                Situacao = SituacaoDemandaAcademica.Concluida
            },
            new DemandaAcademica
            {
                Titulo = "Cancelada atrasada",
                Prazo = hoje.AddDays(-4),
                Situacao = SituacaoDemandaAcademica.Cancelada
            }
        };

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            dbContext.DemandasAcademicas.AddRange(demandasParaCriar);
            await dbContext.SaveChangesAsync();
        }

        var response = await client.GetAsync(
            "/api/demandas-academicas/priorizadas");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var prioridades = await response.Content
            .ReadFromJsonAsync<List<DemandaAcademicaPrioridadeResponse>>();

        Assert.NotNull(prioridades);

        Assert.Equal(
            new[]
            {
                "Prazo vencido",
                "Vence hoje",
                "Amanhã em andamento alta",
                "Amanhã pendente alta",
                "Amanhã baixa",
                "Prazo em 5 dias",
                "Prazo em 10 dias",
                "Prazo em 20 dias",
                "Sem prazo"
            },
            prioridades.Select(p => p.Demanda.Titulo));

        Assert.Equal("Atrasada", prioridades[0].FaixaUrgencia);
        Assert.Equal(-2, prioridades[0].DiasAtePrazo);
        Assert.Contains(
            "Prazo vencido há 2 dias",
            prioridades[0].Justificativa);

        Assert.Equal("Vence hoje", prioridades[1].FaixaUrgencia);
        Assert.Equal("Até 3 dias", prioridades[2].FaixaUrgencia);
        Assert.Equal("Até 7 dias", prioridades[5].FaixaUrgencia);
        Assert.Equal("Até 14 dias", prioridades[6].FaixaUrgencia);
        Assert.Equal("Prazo distante", prioridades[7].FaixaUrgencia);

        Assert.Equal("Sem prazo definido", prioridades[8].FaixaUrgencia);
        Assert.Null(prioridades[8].DiasAtePrazo);
    }

    [Fact]
    public async Task PutDemanda_ComSituacaoInexistente_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new AtualizarDemandaAcademicaRequest
        {
            Titulo = "Preparar apresentação",
            Situacao = (SituacaoDemandaAcademica)999
        };

        var response = await client.PutAsJsonAsync(
            "/api/demandas-academicas/1",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutDemanda_ComTarefaPendente_NaoPermiteConcluir()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        int demandaId;

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            var demanda = new DemandaAcademica
            {
                Titulo = "Preparar prova de banco de dados"
            };

            dbContext.DemandasAcademicas.Add(demanda);
            await dbContext.SaveChangesAsync();

            var tarefa = new TarefaDemanda
            {
                DemandaAcademicaId = demanda.Id,
                Titulo = "Revisar normalização",
                Ordem = 0,
                Situacao = SituacaoTarefaDemanda.Pendente
            };

            dbContext.TarefasDemanda.Add(tarefa);
            await dbContext.SaveChangesAsync();

            demandaId = demanda.Id;
        }

        var request = new AtualizarDemandaAcademicaRequest
        {
            Titulo = "Preparar prova de banco de dados",
            Situacao = SituacaoDemandaAcademica.Concluida
        };

        var response = await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{demandaId}",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var consulta = await client.GetAsync(
            $"/api/demandas-academicas/{demandaId}");

        var demandaConsultada = await consulta.Content
            .ReadFromJsonAsync<DemandaAcademicaResponse>();

        Assert.NotNull(demandaConsultada);
        Assert.Equal(
            SituacaoDemandaAcademica.Pendente,
            demandaConsultada.Situacao);
    }

    [Fact]
    public async Task PutDemanda_Inexistente_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new AtualizarDemandaAcademicaRequest
        {
            Titulo = "Demanda inexistente"
        };

        var response = await client.PutAsJsonAsync(
            "/api/demandas-academicas/999",
            request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PutDemanda_Existente_AtualizaDadosERetornaOk()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var criacao = await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Trabalho inicial"
            });

        Assert.Equal(HttpStatusCode.Created, criacao.StatusCode);

        var criada = await criacao.Content
            .ReadFromJsonAsync<DemandaAcademicaResponse>();

        Assert.NotNull(criada);

        var request = new AtualizarDemandaAcademicaRequest
        {
            Titulo = "Trabalho de Engenharia de Software",
            Descricao = "Preparar a apresentação",
            Tipo = TipoDemandaAcademica.Trabalho,
            Importancia = ImportanciaDemandaAcademica.Alta,
            EsforcoEstimadoMinutos = 180,
            Situacao = SituacaoDemandaAcademica.EmAndamento
        };

        var response = await client.PutAsJsonAsync(
            $"/api/demandas-academicas/{criada.Id}",
            request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var atualizada = await response.Content
            .ReadFromJsonAsync<DemandaAcademicaResponse>();

        Assert.NotNull(atualizada);
        Assert.Equal(criada.Id, atualizada.Id);
        Assert.Equal(request.Titulo, atualizada.Titulo);
        Assert.Equal(request.Descricao, atualizada.Descricao);
        Assert.Equal(request.Tipo, atualizada.Tipo);
        Assert.Equal(request.Importancia, atualizada.Importancia);
        Assert.Equal(request.EsforcoEstimadoMinutos, atualizada.EsforcoEstimadoMinutos);
        Assert.Equal(SituacaoDemandaAcademica.EmAndamento, atualizada.Situacao);
    }

    [Fact]
    public async Task GetDemandas_SemRegistros_RetornaListaVazia()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/api/demandas-academicas");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var demandas = await response.Content
            .ReadFromJsonAsync<List<DemandaAcademicaResponse>>();

        Assert.NotNull(demandas);
        Assert.Empty(demandas);
    }

    [Fact]
    public async Task GetDemandas_ComRegistros_RetornaListaOrdenadaPorTitulo()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Trabalho de Engenharia de Software"
            });

        await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Prova de Banco de Dados"
            });

        var response = await client.GetAsync(
            "/api/demandas-academicas");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var demandas = await response.Content
            .ReadFromJsonAsync<List<DemandaAcademicaResponse>>();

        Assert.NotNull(demandas);
        Assert.Equal(2, demandas.Count);
        Assert.Equal(
            "Prova de Banco de Dados",
            demandas[0].Titulo);
        Assert.Equal(
            "Trabalho de Engenharia de Software",
            demandas[1].Titulo);
    }

    [Fact]
    public async Task PostDemanda_ComDadosValidos_RetornaCreated()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new CriarDemandaAcademicaRequest
        {
            Titulo = "Prova de Banco de Dados",
            Descricao = "Revisar SQL e normalização",
            Tipo = TipoDemandaAcademica.Prova,
            Prazo = new DateOnly(2026, 11, 10),
            Importancia = ImportanciaDemandaAcademica.Alta,
            EsforcoEstimadoMinutos = 120
        };

        var response = await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var criada = await response.Content
            .ReadFromJsonAsync<DemandaAcademicaResponse>();

        Assert.NotNull(criada);
        Assert.True(criada.Id > 0);
        Assert.Equal("Prova de Banco de Dados", criada.Titulo);
        Assert.Equal(TipoDemandaAcademica.Prova, criada.Tipo);
        Assert.Equal(ImportanciaDemandaAcademica.Alta, criada.Importancia);
        Assert.Equal(120, criada.EsforcoEstimadoMinutos);
        Assert.Equal(SituacaoDemandaAcademica.Pendente, criada.Situacao);

        Assert.NotNull(response.Headers.Location);

        var consulta = await client.GetAsync(
            $"/api/demandas-academicas/{criada.Id}");

        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);

        var recuperada = await consulta.Content
            .ReadFromJsonAsync<DemandaAcademicaResponse>();

        Assert.NotNull(recuperada);
        Assert.Equal(criada.Id, recuperada.Id);
        Assert.Equal(criada.Titulo, recuperada.Titulo);
    }

    [Fact]
    public async Task PostDemanda_ComTituloMuitoCurto_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new CriarDemandaAcademicaRequest
        {
            Titulo = " A "
        };

        var response = await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostDemanda_ComEsforcoNegativo_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new CriarDemandaAcademicaRequest
        {
            Titulo = "Preparar apresentação",
            EsforcoEstimadoMinutos = -10
        };

        var response = await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostDemanda_ComTipoInexistente_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new CriarDemandaAcademicaRequest
        {
            Titulo = "Preparar apresentação",
            Tipo = (TipoDemandaAcademica)999
        };

        var response = await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetDemanda_Inexistente_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/api/demandas-academicas/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetDemandas_ComFiltroSituacao_RetornaApenasComSituacaoEspecificada()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        int demandaId;

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            var demandaPendente = new DemandaAcademica
            {
                Titulo = "Tarefa Pendente",
                Situacao = SituacaoDemandaAcademica.Pendente
            };

            var demandaEmAndamento = new DemandaAcademica
            {
                Titulo = "Tarefa Em Andamento",
                Situacao = SituacaoDemandaAcademica.EmAndamento
            };

            dbContext.DemandasAcademicas.Add(demandaPendente);
            dbContext.DemandasAcademicas.Add(demandaEmAndamento);
            await dbContext.SaveChangesAsync();

            demandaId = demandaEmAndamento.Id;
        }

        var response = await client.GetAsync(
            "/api/demandas-academicas?situacao=1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var demandas = await response.Content
            .ReadFromJsonAsync<List<DemandaAcademicaResponse>>();

        Assert.NotNull(demandas);
        Assert.Single(demandas);
        Assert.Equal(SituacaoDemandaAcademica.EmAndamento, demandas[0].Situacao);
    }

    [Fact]
    public async Task GetDemandas_ComFiltroTipo_RetornaApenasComTipoEspecificado()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Prova de Banco",
                Tipo = TipoDemandaAcademica.Prova
            });

        await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Trabalho de Engenharia",
                Tipo = TipoDemandaAcademica.Trabalho
            });

        var response = await client.GetAsync(
            "/api/demandas-academicas?tipo=0");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var demandas = await response.Content
            .ReadFromJsonAsync<List<DemandaAcademicaResponse>>();

        Assert.NotNull(demandas);
        Assert.Single(demandas);
        Assert.Equal(TipoDemandaAcademica.Prova, demandas[0].Tipo);
    }

    [Fact]
    public async Task GetDemandas_ComFiltroImportancia_RetornaApenasComImportanciaEspecificada()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Tarefa Importante",
                Importancia = ImportanciaDemandaAcademica.Alta
            });

        await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Tarefa Menos Importante",
                Importancia = ImportanciaDemandaAcademica.Baixa
            });

        var response = await client.GetAsync(
            "/api/demandas-academicas?importancia=2");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var demandas = await response.Content
            .ReadFromJsonAsync<List<DemandaAcademicaResponse>>();

        Assert.NotNull(demandas);
        Assert.Single(demandas);
        Assert.Equal(ImportanciaDemandaAcademica.Alta, demandas[0].Importancia);
    }

    [Fact]
    public async Task GetDemandas_ComFiltroPrazoAte_RetornaApenasComPrazoMenorOuIgual()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var prazoAnte = new DateOnly(2026, 10, 20);
        var prazoDepois = new DateOnly(2026, 11, 20);

        await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Prova Antes",
                Prazo = prazoAnte
            });

        await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Prova Depois",
                Prazo = prazoDepois
            });

        var response = await client.GetAsync(
            "/api/demandas-academicas?prazoAte=2026-10-20");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var demandas = await response.Content
            .ReadFromJsonAsync<List<DemandaAcademicaResponse>>();

        Assert.NotNull(demandas);
        Assert.Single(demandas);
        Assert.Equal("Prova Antes", demandas[0].Titulo);
    }

    [Fact]
    public async Task GetDemandas_ComFiltroPrazoAteInclusivo_IncluiDemandaComPrazoExato()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var prazoExato = new DateOnly(2026, 10, 20);

        await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Prova no Prazo",
                Prazo = prazoExato
            });

        var response = await client.GetAsync(
            "/api/demandas-academicas?prazoAte=2026-10-20");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var demandas = await response.Content
            .ReadFromJsonAsync<List<DemandaAcademicaResponse>>();

        Assert.NotNull(demandas);
        Assert.Single(demandas);
        Assert.Equal(prazoExato, demandas[0].Prazo);
    }

    [Fact]
    public async Task GetDemandas_ComMultiplosFiltros_AplicaTodosSimultaneamente()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var prazo = new DateOnly(2026, 11, 10);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            var demandasParaCriar = new[]
            {
                new DemandaAcademica
                {
                    Titulo = "Prova Alta Pendente",
                    Tipo = TipoDemandaAcademica.Prova,
                    Importancia = ImportanciaDemandaAcademica.Alta,
                    Situacao = SituacaoDemandaAcademica.Pendente,
                    Prazo = prazo
                },
                new DemandaAcademica
                {
                    Titulo = "Prova Baixa Pendente",
                    Tipo = TipoDemandaAcademica.Prova,
                    Importancia = ImportanciaDemandaAcademica.Baixa,
                    Situacao = SituacaoDemandaAcademica.Pendente,
                    Prazo = prazo
                },
                new DemandaAcademica
                {
                    Titulo = "Trabalho Alta Pendente",
                    Tipo = TipoDemandaAcademica.Trabalho,
                    Importancia = ImportanciaDemandaAcademica.Alta,
                    Situacao = SituacaoDemandaAcademica.Pendente,
                    Prazo = prazo
                }
            };

            dbContext.DemandasAcademicas.AddRange(demandasParaCriar);
            await dbContext.SaveChangesAsync();
        }

        var response = await client.GetAsync(
            "/api/demandas-academicas?tipo=0&importancia=2&situacao=0&prazoAte=2026-11-10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var demandas = await response.Content
            .ReadFromJsonAsync<List<DemandaAcademicaResponse>>();

        Assert.NotNull(demandas);
        Assert.Single(demandas);
        Assert.Equal("Prova Alta Pendente", demandas[0].Titulo);
    }

    [Fact]
    public async Task GetDemandas_ComDataInvalida_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/api/demandas-academicas?prazoAte=data-invalida");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problema = await response.Content
            .ReadFromJsonAsync<ProblemDetails>();

        Assert.NotNull(problema);
        Assert.Contains("Data inválida", problema.Title);
    }

    [Fact]
    public async Task GetDemandas_SemFiltros_RetornaTodas()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Demanda Um",
                Tipo = TipoDemandaAcademica.Prova
            });

        await client.PostAsJsonAsync(
            "/api/demandas-academicas",
            new CriarDemandaAcademicaRequest
            {
                Titulo = "Demanda Dois",
                Tipo = TipoDemandaAcademica.Trabalho
            });

        var response = await client.GetAsync(
            "/api/demandas-academicas");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var demandas = await response.Content
            .ReadFromJsonAsync<List<DemandaAcademicaResponse>>();

        Assert.NotNull(demandas);
        Assert.Equal(2, demandas.Count);
    }

    [Fact]
    public async Task GetDemandas_ComSituacaoTextualInvalida_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/api/demandas-academicas?situacao=invalida");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetDemandas_ComSituacaoNumericaInvalida_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/api/demandas-academicas?situacao=99");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetDemandas_ComTipoNumericoInvalido_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/api/demandas-academicas?tipo=99");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetDemandas_ComImportanciaNumericaInvalida_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/api/demandas-academicas?importancia=99");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public void Inicializacao_ComFusoHorarioValido_RegistraTimeZoneInfoNoContainer()
    {
        using var factory = new CustomWebApplicationFactory();
        var fusoHorario = factory.Services.GetRequiredService<TimeZoneInfo>();

        Assert.NotNull(fusoHorario);
        Assert.Equal("America/Sao_Paulo", fusoHorario.Id);
    }

    [Fact]
    public void Inicializacao_ComFusoHorarioInvalido_LancaExcecao()
    {
        using var factory = new CustomWebApplicationFactory()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("FusoHorario", "Fuso/Invalido_Inexistente");
            });

        var ex = Assert.Throws<InvalidOperationException>(() =>
        {
            _ = factory.Services;
        });

        Assert.Contains("Fuso horário inválido", ex.Message);
    }

    [Fact]
    public void ObterDataNoFuso_InstanteUtcProximoMeiaNoite_RetornaDataCivilDeSaoPaulo()
    {
        var fusoSaoPaulo = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");
        var instanteUtc = DateTime.Parse(
            "2026-10-17T01:30:00Z",
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.AdjustToUniversal);

        var dataNoFuso = PriorizadorDemandasAcademicas.ObterDataNoFuso(
            instanteUtc,
            fusoSaoPaulo);

        Assert.Equal(new DateOnly(2026, 10, 16), dataNoFuso);
    }
}