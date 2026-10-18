using CadernoAtlas.Api.Models;
using CadernoAtlas.Api.Services;
using CadernoAtlas.Api.Contracts.PlanejamentoSemanal;

namespace CadernoAtlas.Api.Tests;

public class PlanejadorSemanalTests
{
    private static readonly DateOnly InicioSemana =
        new(2026, 10, 19); // Segunda-feira

    private static readonly DateTimeOffset Agora =
        new(2026, 10, 19, 8, 0, 0, TimeSpan.FromHours(-3));

    private static readonly TimeZoneInfo FusoHorario =
        TimeZoneInfo.CreateCustomTimeZone(
            "America/Sao_Paulo",
            TimeSpan.FromHours(-3),
            "Brasília",
            "Brasília");

    [Fact]
    public void Planejar_DisponibilidadesConsecutivas_MesclaIntervalos()
    {
        var demanda = CriarDemanda(
            1,
            "A - Preparar prova",
            90,
            InicioSemana.AddDays(3));

        var disponibilidades = new[]
        {
            CriarDisponibilidade(
                InicioSemana,
                new TimeOnly(9, 0),
                new TimeOnly(10, 0)),

            CriarDisponibilidade(
                InicioSemana,
                new TimeOnly(10, 0),
                new TimeOnly(11, 0))
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            disponibilidades,
            Array.Empty<SessaoEstudo>());

        Assert.Empty(resultado.NaoAlocadas);

        AssertAlocacao(
            resultado,
            1,
            InicioSemana,
            new TimeOnly(9, 0),
            90);
    }

    [Fact]
    public void Planejar_SessaoCancelada_NaoBloqueiaHorario()
    {
        var demanda = CriarDemanda(
            1,
            "A - Revisar conteúdo",
            60,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(10, 0));

        var sessaoCancelada = new SessaoEstudo
        {
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Cancelada
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoCancelada });

        Assert.Empty(resultado.NaoAlocadas);

        AssertAlocacao(
            resultado,
            1,
            InicioSemana,
            new TimeOnly(9, 0),
            60);
    }

    [Fact]
     public void Planejar_SessaoConcluida_NaoBloqueiaHorario()
    {
        var demanda = CriarDemanda(
            1,
            "A - Revisar conteúdo",
            60,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(10, 0));

        var sessaoConcluida = new SessaoEstudo
        {
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Concluida
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoConcluida });

        Assert.Empty(resultado.NaoAlocadas);

        AssertAlocacao(
            resultado,
            1,
            InicioSemana,
            new TimeOnly(9, 0),
            60);
    }

    [Fact]
    public void Planejar_SessaoExistenteOcupaIntervalo_RetornaMotivo()
    {
        var demanda = CriarDemanda(
            1,
            "A - Preparar prova",
            120,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(12, 0));

        var sessaoExistente = new SessaoEstudo
        {
            Titulo = "Estudo já planejado",
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(10, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Planejada
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoExistente });

        Assert.Empty(resultado.Alocacoes);

        var naoAlocada = Assert.Single(resultado.NaoAlocadas);

        Assert.Equal(
            MotivoNaoAlocacao.HorarioOcupadoPorSessaoExistente,
            naoAlocada.Motivo);
    }

    [Fact]
    public void Planejar_AgoraComSegundos_ComecaNoProximoMinuto()
    {
        var demanda = CriarDemanda(
            1,
            "A - Revisar conteúdo",
            60,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(11, 0));

        var agora = new DateTimeOffset(
            2026, 10, 19,
            9, 17, 30,
            TimeSpan.FromHours(-3));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, agora),
            new[] { demanda },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        AssertAlocacao(
            resultado,
            1,
            InicioSemana,
            new TimeOnly(9, 18),
            60);
    }

    [Fact]
    public void Planejar_DisponibilidadeComSegundos_UsaSomenteMinutosCompletos()
    {
        var demanda = CriarDemanda(
            1,
            "A - Revisar conteúdo",
            59,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0, 30),
            new TimeOnly(10, 0, 30));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        Assert.Empty(resultado.NaoAlocadas);
        AssertAlocacao(
            resultado,
            1,
            InicioSemana,
            new TimeOnly(9, 1),
            59);
    }

    [Fact]
    public void Planejar_DisponibilidadeComSegundos_NaoUsaFracoesNasExtremidades()
    {
        var demanda = CriarDemanda(
            1,
            "A - Revisar conteúdo",
            60,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0, 30),
            new TimeOnly(10, 0, 30));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        Assert.Empty(resultado.Alocacoes);
        var naoAlocada = Assert.Single(resultado.NaoAlocadas);
        Assert.Equal(
            MotivoNaoAlocacao.DuracaoMaiorQueQualquerDisponibilidade,
            naoAlocada.Motivo);
    }

    [Fact]
    public void Planejar_SessaoComSegundos_ReservaAteOMinutoSeguinte()
    {
        var demanda = CriarDemanda(
            1,
            "A - Revisar conteúdo",
            60,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(11, 1));

        var sessaoExistente = new SessaoEstudo
        {
            Titulo = "Sessão com segundos",
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(10, 0, 30),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Planejada
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoExistente });

        Assert.Empty(resultado.NaoAlocadas);
        AssertAlocacao(
            resultado,
            1,
            InicioSemana,
            new TimeOnly(9, 0),
            60);
    }

    [Fact]
    public void Planejar_SessaoEDisponibilidadeEmLimitesAdjacentes_NaoSobrepoe()
    {
        var demanda = CriarDemanda(
            1,
            "A - Revisar conteúdo",
            60,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(10, 1),
            new TimeOnly(11, 1));

        var sessaoExistente = new SessaoEstudo
        {
            Titulo = "Sessão com segundos",
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0, 30),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Planejada
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoExistente });

        Assert.Empty(resultado.NaoAlocadas);
        AssertAlocacao(
            resultado,
            1,
            InicioSemana,
            new TimeOnly(10, 1),
            60);
    }

    [Fact]
    public void Planejar_AgoraExatamenteNoMinuto_UsaOProprioMinuto()
    {
        var demanda = CriarDemanda(
            1,
            "A - Revisar conteúdo",
            60,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 17),
            new TimeOnly(10, 17));

        var agora = new DateTimeOffset(
            2026, 10, 19,
            9, 17, 0,
            TimeSpan.FromHours(-3));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, agora),
            new[] { demanda },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        AssertAlocacao(
            resultado,
            1,
            InicioSemana,
            new TimeOnly(9, 17),
            60);
    }

    [Fact]
    public void Planejar_AtividadesQueCabem_UsaPrimeiroIntervaloSuficiente()
    {
        var demandas = new[]
        {
            CriarDemanda(
                1,
                "Preparar prova",
                45,
                InicioSemana),

            CriarDemanda(
                2,
                "Revisar conteúdo",
                60,
                InicioSemana.AddDays(1))
        };

        var disponibilidades = new[]
        {
            CriarDisponibilidade(
                InicioSemana,
                new TimeOnly(9, 0),
                new TimeOnly(10, 0)),

            CriarDisponibilidade(
                InicioSemana.AddDays(1),
                new TimeOnly(9, 0),
                new TimeOnly(10, 30))
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        // Act
        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            demandas,
            disponibilidades,
            Array.Empty<SessaoEstudo>());

        // Assert
        Assert.Empty(resultado.NaoAlocadas);

        AssertAlocacao(
            resultado, 1, InicioSemana, new TimeOnly(9, 0), 45);

        AssertAlocacao(
            resultado, 2, InicioSemana.AddDays(1), new TimeOnly(9, 0), 60);
    }

    [Fact]
    public void Planejar_AtividadeLongaNaoCabeNoPrimeiroIntervalo_AproveitaIntervaloParaAtividadeMenor()
    {
        // Arrange
        var demandas = new[]
        {
            CriarDemanda(
                1,
                "Preparar prova",
                70,
                InicioSemana),

            CriarDemanda(
                2,
                "Revisar conteúdo",
                60,
                InicioSemana.AddDays(1))
        };

        var disponibilidades = new[]
        {
            CriarDisponibilidade(
                InicioSemana,
                new TimeOnly(9, 0),
                new TimeOnly(10, 0)),

            CriarDisponibilidade(
                InicioSemana.AddDays(1),
                new TimeOnly(9, 0),
                new TimeOnly(10, 30))
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        // Act
        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            demandas,
            disponibilidades,
            Array.Empty<SessaoEstudo>());

        // Assert
        Assert.Empty(resultado.NaoAlocadas);

        // A atividade de 70 minutos não cabe na segunda-feira.
        AssertAlocacao(
            resultado, 1, InicioSemana.AddDays(1), new TimeOnly(9, 0), 70);

        // O intervalo menor continua disponível para a atividade de 60 minutos.
        AssertAlocacao(
            resultado, 2, InicioSemana, new TimeOnly(9, 0), 60);
    }

    [Fact]
    public void Planejar_SemDisponibilidadeNaSemana_RetornaMotivoCorrespondente()
    {
        var demanda = CriarDemanda(
            1,
            "A - Revisar conteúdo",
            60,
            InicioSemana.AddDays(3));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            Array.Empty<DisponibilidadeEstudo>(),
            Array.Empty<SessaoEstudo>());

        Assert.Empty(resultado.Alocacoes);
        var naoAlocada = Assert.Single(resultado.NaoAlocadas);
        Assert.Equal(
            MotivoNaoAlocacao.SemDisponibilidadeNaSemana,
            naoAlocada.Motivo);
    }

    [Fact]
    public void Planejar_CapacidadeConsumidaPorAtividadePrioritaria_RetornaMotivoCorrespondente()
    {
        var demandaPrioritaria = CriarDemanda(
            1,
            "Prioritaria",
            60,
            InicioSemana.AddDays(1));
        demandaPrioritaria.Importancia = ImportanciaDemandaAcademica.Alta;

        var demandaPosterior = CriarDemanda(
            2,
            "Posterior",
            60,
            InicioSemana.AddDays(5));
        demandaPosterior.Importancia = ImportanciaDemandaAcademica.Baixa;

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(10, 0));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demandaPosterior, demandaPrioritaria },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        AssertAlocacao(
            resultado,
            1,
            InicioSemana,
            new TimeOnly(9, 0),
            60);

        var naoAlocada = Assert.Single(resultado.NaoAlocadas);
        Assert.Equal(2, naoAlocada.DemandaAcademicaId);
        Assert.Equal(
            MotivoNaoAlocacao.CapacidadeConsumidaPorAtividadesPrioritarias,
            naoAlocada.Motivo);
    }

    [Fact]
    public void Planejar_PrioridadePorPrazoEImportancia_InfluenciaAlocacaoReal()
    {
        var demandaPrazoMaisProximo = CriarDemanda(
            1,
            "Prazo próximo",
            60,
            InicioSemana.AddDays(1));
        demandaPrazoMaisProximo.Importancia =
            ImportanciaDemandaAcademica.Baixa;

        var demandaImportante = CriarDemanda(
            2,
            "Prazo distante",
            60,
            InicioSemana.AddDays(7));
        demandaImportante.Importancia =
            ImportanciaDemandaAcademica.Alta;

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(10, 0));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demandaImportante, demandaPrazoMaisProximo },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        AssertAlocacao(
            resultado,
            1,
            InicioSemana,
            new TimeOnly(9, 0),
            60);

        var naoAlocada = Assert.Single(resultado.NaoAlocadas);
        Assert.Equal(2, naoAlocada.DemandaAcademicaId);
        Assert.Equal(
            MotivoNaoAlocacao.CapacidadeConsumidaPorAtividadesPrioritarias,
            naoAlocada.Motivo);
    }

    [Fact]
    public void Planejar_TarefasDaMesmaDemanda_OrdenaPorOrdemEIdNaAlocacao()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho",
            120,
            InicioSemana.AddDays(3));

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 11,
            DemandaAcademicaId = 1,
            Titulo = "Segunda tarefa",
            Ordem = 1,
            EsforcoEstimadoMinutos = 30,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 10,
            DemandaAcademicaId = 1,
            Titulo = "Primeira tarefa",
            Ordem = 0,
            EsforcoEstimadoMinutos = 30,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(10, 0));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        Assert.Equal(
            new[] { 10, 11 },
            resultado.Alocacoes
                .OrderBy(item => item.HoraInicio)
                .Select(item => item.TarefaDemandaId!.Value));
    }

    [Fact]
    public void Planejar_TarefaComEstimativaValida_AlocaHorario()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            120,
            InicioSemana.AddDays(3));

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 10,
            DemandaAcademicaId = 1,
            Titulo = "Modelar ER",
            Ordem = 0,
            EsforcoEstimadoMinutos = 45,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(10, 0));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        Assert.Empty(resultado.NaoAlocadas);

        var alocacao = Assert.Single(resultado.Alocacoes);
        Assert.Null(alocacao.DemandaAcademicaId);
        Assert.Equal(10, alocacao.TarefaDemandaId);
        Assert.Equal("Modelar ER", alocacao.Titulo);
        Assert.Equal(InicioSemana, alocacao.DataPlanejada);
        Assert.Equal(new TimeOnly(9, 0), alocacao.HoraInicio);
        Assert.Equal(45, alocacao.DuracaoPlanejadaMinutos);
    }

    [Fact]
    public void Planejar_TarefaSemEstimativa_RetornaNaoAlocadaComMotivoEstimativaAusente()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            120,
            InicioSemana.AddDays(3));

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 10,
            DemandaAcademicaId = 1,
            Titulo = "Modelar ER",
            Ordem = 0,
            EsforcoEstimadoMinutos = null,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(11, 0));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        Assert.Empty(resultado.Alocacoes);

        var naoAlocada = Assert.Single(resultado.NaoAlocadas);
        Assert.Null(naoAlocada.DemandaAcademicaId);
        Assert.Equal(10, naoAlocada.TarefaDemandaId);
        Assert.Equal("Modelar ER", naoAlocada.Titulo);
        Assert.Equal(MotivoNaoAlocacao.EstimativaAusente, naoAlocada.Motivo);
    }

    [Fact]
    public void Planejar_TarefaComEstimativaZero_RetornaNaoAlocadaComMotivoEstimativaInvalida()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            120,
            InicioSemana.AddDays(3));

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 10,
            DemandaAcademicaId = 1,
            Titulo = "Modelar ER",
            Ordem = 0,
            EsforcoEstimadoMinutos = 0,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(11, 0));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        Assert.Empty(resultado.Alocacoes);

        var naoAlocada = Assert.Single(resultado.NaoAlocadas);
        Assert.Null(naoAlocada.DemandaAcademicaId);
        Assert.Equal(10, naoAlocada.TarefaDemandaId);
        Assert.Equal("Modelar ER", naoAlocada.Titulo);
        Assert.Equal(MotivoNaoAlocacao.EstimativaInvalida, naoAlocada.Motivo);
    }

    [Fact]
    public void Planejar_DemandaSemTarefas_ComSessaoPlanejada_NaoApareceNaPrevia()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            60,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(14, 0),
            new TimeOnly(16, 0));

        var sessaoPlanejada = new SessaoEstudo
        {
            DemandaAcademicaId = 1,
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Planejada
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoPlanejada });

        Assert.DoesNotContain(resultado.Alocacoes, a => a.DemandaAcademicaId == 1);
        Assert.DoesNotContain(resultado.NaoAlocadas, n => n.DemandaAcademicaId == 1);
    }

    [Fact]
    public void Planejar_DemandaSemTarefas_ComSessaoEmAndamento_NaoApareceNaPrevia()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            60,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(14, 0),
            new TimeOnly(16, 0));

        var sessaoEmAndamento = new SessaoEstudo
        {
            DemandaAcademicaId = 1,
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.EmAndamento
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoEmAndamento });

        Assert.DoesNotContain(resultado.Alocacoes, a => a.DemandaAcademicaId == 1);
        Assert.DoesNotContain(resultado.NaoAlocadas, n => n.DemandaAcademicaId == 1);
    }

    [Fact]
    public void Planejar_Tarefa_ComSessaoPlanejada_NaoApareceNaPrevia()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            120,
            InicioSemana.AddDays(3));

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 10,
            DemandaAcademicaId = 1,
            Titulo = "Modelar ER",
            Ordem = 0,
            EsforcoEstimadoMinutos = 60,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(14, 0),
            new TimeOnly(16, 0));

        var sessaoPlanejada = new SessaoEstudo
        {
            TarefaDemandaId = 10,
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Planejada
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoPlanejada });

        Assert.DoesNotContain(resultado.Alocacoes, a => a.TarefaDemandaId == 10);
        Assert.DoesNotContain(resultado.NaoAlocadas, n => n.TarefaDemandaId == 10);
    }

    [Fact]
    public void Planejar_Tarefa_ComSessaoEmAndamento_NaoApareceNaPrevia()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            120,
            InicioSemana.AddDays(3));

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 10,
            DemandaAcademicaId = 1,
            Titulo = "Modelar ER",
            Ordem = 0,
            EsforcoEstimadoMinutos = 60,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(14, 0),
            new TimeOnly(16, 0));

        var sessaoEmAndamento = new SessaoEstudo
        {
            TarefaDemandaId = 10,
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.EmAndamento
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoEmAndamento });

        Assert.DoesNotContain(resultado.Alocacoes, a => a.TarefaDemandaId == 10);
        Assert.DoesNotContain(resultado.NaoAlocadas, n => n.TarefaDemandaId == 10);
    }

    [Fact]
    public void Planejar_DemandaSemTarefas_ComSessaoConcluida_PermiteAlocacao()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            60,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(10, 0));

        var sessaoConcluida = new SessaoEstudo
        {
            DemandaAcademicaId = 1,
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Concluida
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoConcluida });

        Assert.Empty(resultado.NaoAlocadas);
        AssertAlocacao(resultado, 1, InicioSemana, new TimeOnly(9, 0), 60);
    }

    [Fact]
    public void Planejar_DemandaSemTarefas_ComSessaoCancelada_PermiteAlocacao()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            60,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(10, 0));

        var sessaoCancelada = new SessaoEstudo
        {
            DemandaAcademicaId = 1,
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Cancelada
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoCancelada });

        Assert.Empty(resultado.NaoAlocadas);
        AssertAlocacao(resultado, 1, InicioSemana, new TimeOnly(9, 0), 60);
    }

    [Fact]
    public void Planejar_TarefaComSessaoAtiva_NaoImpedeOutraTarefaDaMesmaDemanda()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            120,
            InicioSemana.AddDays(3));

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 10,
            DemandaAcademicaId = 1,
            Titulo = "Modelar ER",
            Ordem = 0,
            EsforcoEstimadoMinutos = 60,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 11,
            DemandaAcademicaId = 1,
            Titulo = "Implementar SQL",
            Ordem = 1,
            EsforcoEstimadoMinutos = 45,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(14, 0),
            new TimeOnly(16, 0));

        var sessaoAtivaTarefa10 = new SessaoEstudo
        {
            TarefaDemandaId = 10,
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Planejada
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoAtivaTarefa10 });

        // Tarefa 10 não reaparece
        Assert.DoesNotContain(resultado.Alocacoes, a => a.TarefaDemandaId == 10);
        Assert.DoesNotContain(resultado.NaoAlocadas, n => n.TarefaDemandaId == 10);

        // Tarefa 11 é alocada
        var alocacaoTarefa11 = Assert.Single(
            resultado.Alocacoes,
            a => a.TarefaDemandaId == 11);
        Assert.Equal(InicioSemana, alocacaoTarefa11.DataPlanejada);
        Assert.Equal(new TimeOnly(14, 0), alocacaoTarefa11.HoraInicio);
        Assert.Equal(45, alocacaoTarefa11.DuracaoPlanejadaMinutos);
    }

    [Fact]
    public void Planejar_SessaoAtivaDeOutraAtividade_NaoImpedePlanejamentoDeAtividadeDiferente()
    {
        var demanda1 = CriarDemanda(
            1,
            "Demanda com sessao ativa",
            60,
            InicioSemana.AddDays(2));

        var demanda2 = CriarDemanda(
            2,
            "Demanda elegivel diferente",
            45,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(14, 0),
            new TimeOnly(16, 0));

        var sessaoAtivaDemanda1 = new SessaoEstudo
        {
            DemandaAcademicaId = 1,
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Planejada
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda1, demanda2 },
            new[] { disponibilidade },
            new[] { sessaoAtivaDemanda1 });

        // Demanda 1 não aparece
        Assert.DoesNotContain(resultado.Alocacoes, a => a.DemandaAcademicaId == 1);
        Assert.DoesNotContain(resultado.NaoAlocadas, n => n.DemandaAcademicaId == 1);

        // Demanda 2 é alocada
        var alocacaoDemanda2 = Assert.Single(
            resultado.Alocacoes,
            a => a.DemandaAcademicaId == 2);
        Assert.Equal(InicioSemana, alocacaoDemanda2.DataPlanejada);
        Assert.Equal(new TimeOnly(14, 0), alocacaoDemanda2.HoraInicio);
        Assert.Equal(45, alocacaoDemanda2.DuracaoPlanejadaMinutos);
    }

    [Fact]
    public void Planejar_TarefaComEstimativaNegativa_RetornaNaoAlocadaComMotivoEstimativaInvalida()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            120,
            InicioSemana.AddDays(3));

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 10,
            DemandaAcademicaId = 1,
            Titulo = "Modelar ER",
            Ordem = 0,
            EsforcoEstimadoMinutos = -5,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(11, 0));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        Assert.Empty(resultado.Alocacoes);

        var naoAlocada = Assert.Single(resultado.NaoAlocadas);
        Assert.Null(naoAlocada.DemandaAcademicaId);
        Assert.Equal(10, naoAlocada.TarefaDemandaId);
        Assert.Equal("Modelar ER", naoAlocada.Titulo);
        Assert.Equal(MotivoNaoAlocacao.EstimativaInvalida, naoAlocada.Motivo);
    }

    [Fact]
    public void Planejar_DemandaSemTarefasComEstimativaZero_RetornaNaoAlocadaComMotivoEstimativaInvalida()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            0,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(11, 0));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        Assert.Empty(resultado.Alocacoes);

        var naoAlocada = Assert.Single(resultado.NaoAlocadas);
        Assert.Equal(1, naoAlocada.DemandaAcademicaId);
        Assert.Null(naoAlocada.TarefaDemandaId);
        Assert.Equal("Trabalho de BD", naoAlocada.Titulo);
        Assert.Equal(MotivoNaoAlocacao.EstimativaInvalida, naoAlocada.Motivo);
    }

    [Fact]
    public void Planejar_DemandaSemTarefasComEstimativaNegativa_RetornaNaoAlocadaComMotivoEstimativaInvalida()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            -10,
            InicioSemana.AddDays(3));

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(11, 0));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            Array.Empty<SessaoEstudo>());

        Assert.Empty(resultado.Alocacoes);

        var naoAlocada = Assert.Single(resultado.NaoAlocadas);
        Assert.Equal(1, naoAlocada.DemandaAcademicaId);
        Assert.Null(naoAlocada.TarefaDemandaId);
        Assert.Equal("Trabalho de BD", naoAlocada.Titulo);
        Assert.Equal(MotivoNaoAlocacao.EstimativaInvalida, naoAlocada.Motivo);
    }

    [Theory]
    [InlineData(SituacaoSessaoEstudo.Concluida)]
    [InlineData(SituacaoSessaoEstudo.Cancelada)]
    public void Planejar_TarefaComSessaoConcluidaOuCancelada_PermiteAlocacao(
        SituacaoSessaoEstudo situacaoSessao)
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            120,
            InicioSemana.AddDays(3));

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 10,
            DemandaAcademicaId = 1,
            Titulo = "Modelar ER",
            Ordem = 0,
            EsforcoEstimadoMinutos = 60,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(9, 0),
            new TimeOnly(10, 0));

        var sessao = new SessaoEstudo
        {
            TarefaDemandaId = 10,
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = situacaoSessao
        };

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessao });

        Assert.Empty(resultado.NaoAlocadas);
        var alocacao = Assert.Single(resultado.Alocacoes);
        Assert.Equal(10, alocacao.TarefaDemandaId);
        Assert.Equal(InicioSemana, alocacao.DataPlanejada);
        Assert.Equal(new TimeOnly(9, 0), alocacao.HoraInicio);
        Assert.Equal(60, alocacao.DuracaoPlanejadaMinutos);
    }

    [Fact]
    public void Planejar_DemandaComTarefas_SessaoAtivaLigadaADemanda_NaoSuprimeTarefas()
    {
        var demanda = CriarDemanda(
            1,
            "Trabalho de BD",
            120,
            InicioSemana.AddDays(3));

        demanda.Tarefas.Add(new TarefaDemanda
        {
            Id = 10,
            DemandaAcademicaId = 1,
            Titulo = "Modelar ER",
            Ordem = 0,
            EsforcoEstimadoMinutos = 60,
            Situacao = SituacaoTarefaDemanda.Pendente
        });

        // Sessão ativa vinculada diretamente à Demanda (TarefaDemandaId == null)
        var sessaoAtivaDemanda = new SessaoEstudo
        {
            DemandaAcademicaId = 1,
            TarefaDemandaId = null,
            DataPlanejada = InicioSemana,
            HoraInicioPlanejada = new TimeOnly(9, 0),
            DuracaoPlanejadaMinutos = 60,
            Situacao = SituacaoSessaoEstudo.Planejada
        };

        // Disponibilidade em horário diferente da sessão para permitir alocação da tarefa
        var disponibilidade = CriarDisponibilidade(
            InicioSemana,
            new TimeOnly(14, 0),
            new TimeOnly(16, 0));

        var planejador = new PlanejadorSemanal(FusoHorario);

        var resultado = planejador.Planejar(
            new PlanejarSemanaRequest(InicioSemana, Agora),
            new[] { demanda },
            new[] { disponibilidade },
            new[] { sessaoAtivaDemanda });

        Assert.Empty(resultado.NaoAlocadas);

        var alocacao = Assert.Single(resultado.Alocacoes);
        Assert.Null(alocacao.DemandaAcademicaId);
        Assert.Equal(10, alocacao.TarefaDemandaId);
        Assert.Equal("Modelar ER", alocacao.Titulo);
        Assert.Equal(InicioSemana, alocacao.DataPlanejada);
        Assert.Equal(new TimeOnly(14, 0), alocacao.HoraInicio);
        Assert.Equal(60, alocacao.DuracaoPlanejadaMinutos);
    }

    private static DemandaAcademica CriarDemanda(
        int id,
        string titulo,
        int esforcoMinutos,
        DateOnly prazo)
    {
        return new DemandaAcademica
        {
            Id = id,
            Titulo = titulo,
            Prazo = prazo,
            EsforcoEstimadoMinutos = esforcoMinutos,
            Importancia = ImportanciaDemandaAcademica.Alta,
            Situacao = SituacaoDemandaAcademica.Pendente
        };
    }

    private static DisponibilidadeEstudo CriarDisponibilidade(
        DateOnly data,
        TimeOnly inicio,
        TimeOnly fim)
    {
        return new DisponibilidadeEstudo
        {
            Data = data,
            HoraInicio = inicio,
            HoraFim = fim
        };
    }

    private static void AssertAlocacao(
        PlanejamentoSemanalResponse resultado,
        int demandaId,
        DateOnly data,
        TimeOnly horaInicio,
        int duracaoMinutos)
    {
        var alocacao = Assert.Single(
            resultado.Alocacoes,
            item => item.DemandaAcademicaId == demandaId);

        Assert.Equal(data, alocacao.DataPlanejada);
        Assert.Equal(horaInicio, alocacao.HoraInicio);
        Assert.Equal(duracaoMinutos, alocacao.DuracaoPlanejadaMinutos);
    }
}
