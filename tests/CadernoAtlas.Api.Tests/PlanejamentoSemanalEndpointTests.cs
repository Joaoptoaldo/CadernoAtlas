using System.Net;
using System.Net.Http.Json;
using CadernoAtlas.Api.Contracts.PlanejamentoSemanal;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CadernoAtlas.Api.Tests;

public class PlanejamentoSemanalEndpointTests
{
    private static readonly DateOnly InicioSemana = new(2026, 10, 19);
    private static readonly DateTimeOffset Agora = new(
        2026, 10, 19, 8, 0, 0, TimeSpan.FromHours(-3));

    [Fact]
    public async Task GetPrevia_DadosDeOrigemAlterados_GeraNovoPropostaId()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));

        await factory.InicializarBancoAsync();

        int demandaId;

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            var demanda = new DemandaAcademica
            {
                Titulo = "Preparar prova",
                EsforcoEstimadoMinutos = 60,
                Importancia = ImportanciaDemandaAcademica.Media,
                Situacao = SituacaoDemandaAcademica.Pendente
            };

            dbContext.DemandasAcademicas.Add(demanda);

            dbContext.DisponibilidadesEstudo.Add(
                new DisponibilidadeEstudo
                {
                    Data = InicioSemana,
                    HoraInicio = new TimeOnly(9, 0),
                    HoraFim = new TimeOnly(12, 0)
                });

            await dbContext.SaveChangesAsync();
            demandaId = demanda.Id;
        }

        using var client = factory.CreateClient();

        var url =
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana:yyyy-MM-dd}";

        var primeiraResponse = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.OK, primeiraResponse.StatusCode);

        var primeira = await primeiraResponse.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();

        Assert.NotNull(primeira);

        var alocacaoOriginal = Assert.Single(primeira.Alocacoes);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            var demanda = await dbContext.DemandasAcademicas
                .SingleAsync(item => item.Id == demandaId);

            // Altera um dado de origem sem mudar a atividade alocada.
            demanda.Importancia = ImportanciaDemandaAcademica.Alta;

            await dbContext.SaveChangesAsync();
        }

        var segundaResponse = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.OK, segundaResponse.StatusCode);

        var segunda = await segundaResponse.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();

        Assert.NotNull(segunda);

        Assert.Equal(
            alocacaoOriginal,
            Assert.Single(segunda.Alocacoes));

        Assert.NotEqual(
            primeira.PropostaId,
            segunda.PropostaId);
    }

    [Fact]
    public async Task GetPrevia_ComInicioDeSemanaValido_RetornaSemanaEInstanteDoServidor()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana:yyyy-MM-dd}&agora=2030-01-01T00:00:00Z");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var planejamento = await response.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();

        Assert.NotNull(planejamento);
        Assert.Equal(InicioSemana, planejamento.InicioSemana);
        Assert.Equal(Agora, planejamento.Agora);

        Assert.StartsWith(
            "hmac-sha256:",
            planejamento.PropostaId);

        var respostaRepetida = await client.GetAsync(
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana:yyyy-MM-dd}&agora=2030-01-01T00:00:00Z");

        Assert.Equal(
            HttpStatusCode.OK,
            respostaRepetida.StatusCode);

        var planejamentoRepetido = await respostaRepetida.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();

        Assert.NotNull(planejamentoRepetido);

        Assert.Equal(
            planejamento.PropostaId,
            planejamentoRepetido.PropostaId);
    }

    [Fact]
    public async Task GetPrevia_ComDiaDiferenteDeSegunda_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana.AddDays(1):yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetPrevia_SemInicioDeSemana_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/api/planejamento-semanal/previa");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetPrevia_ComInicioDeSemanaMalformado_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/api/planejamento-semanal/previa?inicioSemana=nao-e-uma-data");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetPrevia_DemandaSemTarefasComEstimativaEDisponibilidade_RetornaAlocacaoSemPersistir()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));
        await factory.InicializarBancoAsync();
        int demandaId;
        int sessoesAntes;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var demanda = new DemandaAcademica
            {
                Titulo = "Preparar prova",
                EsforcoEstimadoMinutos = 60
            };
            dbContext.DemandasAcademicas.Add(demanda);
            dbContext.DisponibilidadesEstudo.Add(new DisponibilidadeEstudo
            {
                Data = InicioSemana,
                HoraInicio = new TimeOnly(9, 0),
                HoraFim = new TimeOnly(10, 0)
            });
            await dbContext.SaveChangesAsync();
            demandaId = demanda.Id;
            sessoesAntes = await dbContext.SessoesEstudo.CountAsync();
        }

        using var client = factory.CreateClient();
        var response = await client.GetAsync(
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana:yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var planejamento = await response.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();

        Assert.NotNull(planejamento);
        var alocacao = Assert.Single(planejamento.Alocacoes);
        Assert.Equal(demandaId, alocacao.DemandaAcademicaId);
        Assert.Equal(InicioSemana, alocacao.DataPlanejada);
        Assert.Equal(new TimeOnly(9, 0), alocacao.HoraInicio);

        using var consultaScope = factory.Services.CreateScope();
        var consultaDbContext = consultaScope.ServiceProvider
            .GetRequiredService<AppDbContext>();
        Assert.Equal(sessoesAntes, await consultaDbContext.SessoesEstudo.CountAsync());
        Assert.Equal(60, (await consultaDbContext.DemandasAcademicas
            .SingleAsync(item => item.Id == demandaId)).EsforcoEstimadoMinutos);
    }

    [Fact]
    public async Task GetPrevia_DemandaComTarefasPlanejaTarefaElegivelComSuaEstimativa()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));
        await factory.InicializarBancoAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var demanda = new DemandaAcademica
            {
                Titulo = "Trabalho de banco de dados",
                EsforcoEstimadoMinutos = 120,
                Tarefas =
                {
                    new TarefaDemanda
                    {
                        Titulo = "Modelar ER",
                        Ordem = 0,
                        EsforcoEstimadoMinutos = 30
                    },
                    new TarefaDemanda
                    {
                        Titulo = "Tarefa concluída",
                        Ordem = 1,
                        EsforcoEstimadoMinutos = 90,
                        Situacao = SituacaoTarefaDemanda.Concluida
                    }
                }
            };
            dbContext.DemandasAcademicas.Add(demanda);
            dbContext.DisponibilidadesEstudo.Add(new DisponibilidadeEstudo
            {
                Data = InicioSemana,
                HoraInicio = new TimeOnly(9, 0),
                HoraFim = new TimeOnly(10, 0)
            });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        var response = await client.GetAsync(
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana:yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var planejamento = await response.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();
        Assert.NotNull(planejamento);

        var alocacao = Assert.Single(planejamento.Alocacoes);
        Assert.Null(alocacao.DemandaAcademicaId);
        Assert.Equal("Modelar ER", alocacao.Titulo);
        Assert.Equal(30, alocacao.DuracaoPlanejadaMinutos);
        Assert.Empty(planejamento.NaoAlocadas);
    }

    [Fact]
    public async Task GetPrevia_AtividadeSemEstimativa_RetornaMotivoEstimativaAusente()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));
        await factory.InicializarBancoAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            dbContext.DemandasAcademicas.Add(new DemandaAcademica
            {
                Titulo = "Demanda sem estimativa"
            });
            dbContext.DisponibilidadesEstudo.Add(new DisponibilidadeEstudo
            {
                Data = InicioSemana,
                HoraInicio = new TimeOnly(9, 0),
                HoraFim = new TimeOnly(10, 0)
            });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        var response = await client.GetAsync(
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana:yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var planejamento = await response.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();
        Assert.NotNull(planejamento);
        Assert.Empty(planejamento.Alocacoes);
        Assert.Equal(
            MotivoNaoAlocacao.EstimativaAusente,
            Assert.Single(planejamento.NaoAlocadas).Motivo);
    }

    [Fact]
    public async Task GetPrevia_SessaoAtivaDeOutraDataSuprimeAtividadeVinculada()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));
        await factory.InicializarBancoAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var demandaComSessao = new DemandaAcademica
            {
                Titulo = "Já planejada",
                EsforcoEstimadoMinutos = 30
            };
            var demandaElegivel = new DemandaAcademica
            {
                Titulo = "Outra demanda",
                EsforcoEstimadoMinutos = 30
            };
            dbContext.DemandasAcademicas.AddRange(demandaComSessao, demandaElegivel);
            await dbContext.SaveChangesAsync();
            dbContext.SessoesEstudo.Add(new SessaoEstudo
            {
                Titulo = demandaComSessao.Titulo,
                DemandaAcademicaId = demandaComSessao.Id,
                DataPlanejada = InicioSemana.AddDays(7),
                HoraInicioPlanejada = new TimeOnly(9, 0),
                DuracaoPlanejadaMinutos = 30,
                Situacao = SituacaoSessaoEstudo.Planejada
            });
            dbContext.DisponibilidadesEstudo.Add(new DisponibilidadeEstudo
            {
                Data = InicioSemana,
                HoraInicio = new TimeOnly(9, 0),
                HoraFim = new TimeOnly(10, 0)
            });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        var response = await client.GetAsync(
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana:yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var planejamento = await response.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();
        Assert.NotNull(planejamento);
        var alocacao = Assert.Single(planejamento.Alocacoes);
        Assert.Equal("Outra demanda", alocacao.Titulo);
        Assert.DoesNotContain(
            planejamento.NaoAlocadas,
            atividade => atividade.Titulo == "Já planejada");
    }

    [Fact]
    public async Task GetPrevia_SessaoAtivaCruzaFronteiraDaSemana_EvitaSobreposicao()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(new DateTimeOffset(
                2026, 10, 18, 8, 0, 0, TimeSpan.FromHours(-3))));
        await factory.InicializarBancoAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            dbContext.DemandasAcademicas.Add(new DemandaAcademica
            {
                Titulo = "Atividade da semana",
                EsforcoEstimadoMinutos = 60
            });
            dbContext.SessoesEstudo.Add(new SessaoEstudo
            {
                Titulo = "Sessão que cruza a meia-noite",
                DataPlanejada = InicioSemana.AddDays(-1),
                HoraInicioPlanejada = new TimeOnly(23, 30),
                DuracaoPlanejadaMinutos = 90,
                Situacao = SituacaoSessaoEstudo.EmAndamento
            });
            dbContext.DisponibilidadesEstudo.Add(new DisponibilidadeEstudo
            {
                Data = InicioSemana,
                HoraInicio = new TimeOnly(0, 0),
                HoraFim = new TimeOnly(3, 0)
            });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        var response = await client.GetAsync(
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana:yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var planejamento = await response.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();
        Assert.NotNull(planejamento);
        var alocacao = Assert.Single(planejamento.Alocacoes);
        Assert.Equal(new TimeOnly(1, 0), alocacao.HoraInicio);
        Assert.Equal(60, alocacao.DuracaoPlanejadaMinutos);
    }

    [Theory]
    [InlineData(SituacaoSessaoEstudo.Concluida)]
    [InlineData(SituacaoSessaoEstudo.Cancelada)]
    public async Task GetPrevia_SessaoConcluidaOuCancelada_NaoBloqueiaAtividade(
        SituacaoSessaoEstudo situacao)
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));
        await factory.InicializarBancoAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            dbContext.DemandasAcademicas.Add(new DemandaAcademica
            {
                Titulo = "Preparar prova",
                EsforcoEstimadoMinutos = 60
            });
            dbContext.SessoesEstudo.Add(new SessaoEstudo
            {
                Titulo = "Sessão anterior",
                DataPlanejada = InicioSemana,
                HoraInicioPlanejada = new TimeOnly(9, 0),
                DuracaoPlanejadaMinutos = 60,
                Situacao = situacao
            });
            dbContext.DisponibilidadesEstudo.Add(new DisponibilidadeEstudo
            {
                Data = InicioSemana,
                HoraInicio = new TimeOnly(9, 0),
                HoraFim = new TimeOnly(10, 0)
            });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        var response = await client.GetAsync(
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana:yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var planejamento = await response.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();
        Assert.NotNull(planejamento);
        Assert.Empty(planejamento.NaoAlocadas);
        Assert.Equal(new TimeOnly(9, 0), Assert.Single(planejamento.Alocacoes).HoraInicio);
    }

    [Fact]
    public async Task GetPrevia_DisponibilidadesIncluemDomingoMasExcluemForaDaSemana()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));
        await factory.InicializarBancoAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            dbContext.DemandasAcademicas.AddRange(
                new DemandaAcademica
                {
                    Titulo = "Alocada no domingo",
                    EsforcoEstimadoMinutos = 30
                },
                new DemandaAcademica
                {
                    Titulo = "Sem disponibilidade na semana",
                    EsforcoEstimadoMinutos = 30
                });
            dbContext.DisponibilidadesEstudo.AddRange(
                new DisponibilidadeEstudo
                {
                    Data = InicioSemana.AddDays(6),
                    HoraInicio = new TimeOnly(9, 0),
                    HoraFim = new TimeOnly(9, 30)
                },
                new DisponibilidadeEstudo
                {
                    Data = InicioSemana.AddDays(7),
                    HoraInicio = new TimeOnly(9, 0),
                    HoraFim = new TimeOnly(10, 0)
                });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        var response = await client.GetAsync(
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana:yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var planejamento = await response.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();
        Assert.NotNull(planejamento);
        Assert.Equal(
            new[] { "Alocada no domingo" },
            planejamento.Alocacoes.Select(item => item.Titulo));
        var naoAlocada = Assert.Single(planejamento.NaoAlocadas);
        Assert.Equal("Sem disponibilidade na semana", naoAlocada.Titulo);
        Assert.Equal(
            MotivoNaoAlocacao.CapacidadeConsumidaPorAtividadesPrioritarias,
            naoAlocada.Motivo);
    }

    [Fact]
    public async Task PostConfirmar_ComPropostaValida_CriaSessoesEsperadas()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));

        await factory.InicializarBancoAsync();
        await AdicionarDemandaEDisponibilidadeAsync(factory);

        using var client = factory.CreateClient();
        var previa = await ObterPreviaAsync(client);

        var response = await client.PostAsJsonAsync(
            "/api/planejamento-semanal/confirmar",
            new ConfirmarPlanejamentoSemanalRequest(
                previa.InicioSemana,
                previa.Agora,
                previa.PropostaId,
                previa.Alocacoes));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var confirmacao = await response.Content
            .ReadFromJsonAsync<ConfirmarPlanejamentoSemanalResponse>();

        Assert.NotNull(confirmacao);
        var sessao = Assert.Single(confirmacao.SessoesCriadas);
        Assert.Equal(previa.Alocacoes[0].Titulo, sessao.Titulo);
        Assert.Equal(
            previa.Alocacoes[0].DuracaoPlanejadaMinutos,
            sessao.DuracaoPlanejadaMinutos);
        Assert.Equal(SituacaoSessaoEstudo.Planejada, sessao.Situacao);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider
            .GetRequiredService<AppDbContext>();

        Assert.Equal(1, await dbContext.SessoesEstudo.CountAsync());
    }

    [Fact]
    public async Task PostConfirmar_ComAlocacaoAdulterada_RetornaConflictESemPersistir()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));

        await factory.InicializarBancoAsync();
        await AdicionarDemandaEDisponibilidadeAsync(factory);

        using var client = factory.CreateClient();
        var previa = await ObterPreviaAsync(client);
        var alocacaoAdulterada = previa.Alocacoes
            .Select(item => item with
            {
                DuracaoPlanejadaMinutos =
                    item.DuracaoPlanejadaMinutos + 1
            })
            .ToList();

        var response = await client.PostAsJsonAsync(
            "/api/planejamento-semanal/confirmar",
            new ConfirmarPlanejamentoSemanalRequest(
                previa.InicioSemana,
                previa.Agora,
                previa.PropostaId,
                alocacaoAdulterada));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider
            .GetRequiredService<AppDbContext>();

        Assert.Equal(0, await dbContext.SessoesEstudo.CountAsync());
    }

    [Fact]
    public async Task PostConfirmar_ComDadosDeOrigemAlterados_RetornaConflictESemPersistir()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));

        await factory.InicializarBancoAsync();
        var demandaId = await AdicionarDemandaEDisponibilidadeAsync(factory);

        using var client = factory.CreateClient();
        var previa = await ObterPreviaAsync(client);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();
            var demanda = await dbContext.DemandasAcademicas
                .SingleAsync(item => item.Id == demandaId);

            demanda.Importancia = ImportanciaDemandaAcademica.Alta;
            await dbContext.SaveChangesAsync();
        }

        var response = await client.PostAsJsonAsync(
            "/api/planejamento-semanal/confirmar",
            new ConfirmarPlanejamentoSemanalRequest(
                previa.InicioSemana,
                previa.Agora,
                previa.PropostaId,
                previa.Alocacoes));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        using var verificationScope = factory.Services.CreateScope();
        var verificationContext = verificationScope.ServiceProvider
            .GetRequiredService<AppDbContext>();

        Assert.Equal(0, await verificationContext.SessoesEstudo.CountAsync());
    }

    [Fact]
    public async Task PostConfirmar_SemInicioDeSemana_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));

        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/planejamento-semanal/confirmar",
            new
            {
                agora = Agora,
                propostaId = "hmac-sha256:0000000000000000000000000000000000000000000000000000000000000000",
                alocacoes = Array.Empty<AlocacaoPlanejamentoResponse>()
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostConfirmar_ComAlocacaoNula_RetornaBadRequestESemPersistir()
    {
        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(Agora));

        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/planejamento-semanal/confirmar",
            new
            {
                inicioSemana = InicioSemana,
                agora = Agora,
                propostaId =
                    "hmac-sha256:0000000000000000000000000000000000000000000000000000000000000000",
                alocacoes = new object?[] { null }
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider
            .GetRequiredService<AppDbContext>();

        Assert.Equal(0, await dbContext.SessoesEstudo.CountAsync());
    }

    [Fact]
    public async Task PostConfirmar_ComInicioExatamenteNoInstanteAtual_RetornaConflictESemPersistir()
    {
        var agoraExato = new DateTimeOffset(
            2026,
            10,
            19,
            9,
            0,
            0,
            TimeSpan.FromHours(-3));

        using var factory = new CustomWebApplicationFactory(
            new FixedTimeProvider(agoraExato));

        await factory.InicializarBancoAsync();
        await AdicionarDemandaEDisponibilidadeAsync(factory);

        using var client = factory.CreateClient();
        var previa = await ObterPreviaAsync(client);

        Assert.Equal(
            new TimeOnly(9, 0),
            Assert.Single(previa.Alocacoes).HoraInicio);

        var response = await client.PostAsJsonAsync(
            "/api/planejamento-semanal/confirmar",
            new ConfirmarPlanejamentoSemanalRequest(
                previa.InicioSemana,
                previa.Agora,
                previa.PropostaId,
                previa.Alocacoes));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider
            .GetRequiredService<AppDbContext>();

        Assert.Equal(0, await dbContext.SessoesEstudo.CountAsync());
    }

    private static async Task<int> AdicionarDemandaEDisponibilidadeAsync(
        CustomWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider
            .GetRequiredService<AppDbContext>();

        var demanda = new DemandaAcademica
        {
            Titulo = "Preparar confirmação",
            EsforcoEstimadoMinutos = 60,
            Importancia = ImportanciaDemandaAcademica.Media,
            Situacao = SituacaoDemandaAcademica.Pendente
        };

        dbContext.DemandasAcademicas.Add(demanda);
        dbContext.DisponibilidadesEstudo.Add(
            new DisponibilidadeEstudo
            {
                Data = InicioSemana,
                HoraInicio = new TimeOnly(9, 0),
                HoraFim = new TimeOnly(12, 0)
            });

        await dbContext.SaveChangesAsync();
        return demanda.Id;
    }

    private static async Task<PlanejamentoSemanalResponse> ObterPreviaAsync(
        HttpClient client)
    {
        var response = await client.GetAsync(
            $"/api/planejamento-semanal/previa?inicioSemana={InicioSemana:yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var previa = await response.Content
            .ReadFromJsonAsync<PlanejamentoSemanalResponse>();

        Assert.NotNull(previa);
        Assert.NotEmpty(previa.Alocacoes);
        return previa;
    }

    private sealed class FixedTimeProvider(DateTimeOffset instant)
        : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => instant.ToUniversalTime();
    }
}
