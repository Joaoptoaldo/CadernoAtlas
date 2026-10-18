using CadernoAtlas.Api.Models;
using CadernoAtlas.Api.Services;

namespace CadernoAtlas.Api.Tests;

public sealed class PlanejamentoSemanalDadosFingerprintServiceTests
{
    private static DemandaAcademica CriarDemanda(
        int id,
        int esforco = 60)
    {
        return new DemandaAcademica
        {
            Id = id,
            Titulo = $"Demanda {id}",
            Tipo = TipoDemandaAcademica.Outro,
            Importancia = ImportanciaDemandaAcademica.Media,
            EsforcoEstimadoMinutos = esforco,
            Situacao = SituacaoDemandaAcademica.Pendente
        };
    }

    private static DisponibilidadeEstudo CriarDisponibilidade(
        TimeOnly inicio = default)
    {
        return new DisponibilidadeEstudo
        {
            Data = new DateOnly(2026, 10, 19),
            HoraInicio = inicio == default
                ? new TimeOnly(9, 0)
                : inicio,
            HoraFim = new TimeOnly(12, 0)
        };
    }

    private static SessaoEstudo CriarSessao(
        TimeOnly inicio = default)
    {
        return new SessaoEstudo
        {
            DataPlanejada = new DateOnly(2026, 10, 19),
            HoraInicioPlanejada = inicio == default
                ? new TimeOnly(10, 0)
                : inicio,
            DuracaoPlanejadaMinutos = 30,
            Situacao = SituacaoSessaoEstudo.Planejada
        };
    }

    [Fact]
    public void Calcular_MesmosDados_GeraMesmoFingerprint()
    {
        var demandas = new[]
        {
            CriarDemanda(2),
            CriarDemanda(1)
        };

        var disponibilidades = new[]
        {
            CriarDisponibilidade(new TimeOnly(14, 0)),
            CriarDisponibilidade()
        };

        var primeiro = PlanejamentoSemanalDadosFingerprintService.Calcular(
            demandas,
            disponibilidades,
            [CriarSessao()]);

        var segundo = PlanejamentoSemanalDadosFingerprintService.Calcular(
            demandas.Reverse(),
            disponibilidades.Reverse(),
            [CriarSessao()]);

        Assert.Equal(primeiro, segundo);
    }

    [Fact]
    public void Calcular_EstimativaAlterada_GeraFingerprintDiferente()
    {
        var original = PlanejamentoSemanalDadosFingerprintService.Calcular(
            [CriarDemanda(1, 60)],
            [CriarDisponibilidade()],
            []);

        var alterado = PlanejamentoSemanalDadosFingerprintService.Calcular(
            [CriarDemanda(1, 90)],
            [CriarDisponibilidade()],
            []);

        Assert.NotEqual(original, alterado);
    }

    [Fact]
    public void Calcular_DisponibilidadeAlterada_GeraFingerprintDiferente()
    {
        var original = PlanejamentoSemanalDadosFingerprintService.Calcular(
            [CriarDemanda(1)],
            [CriarDisponibilidade()],
            []);

        var alterado = PlanejamentoSemanalDadosFingerprintService.Calcular(
            [CriarDemanda(1)],
            [CriarDisponibilidade(new TimeOnly(9, 30))],
            []);

        Assert.NotEqual(original, alterado);
    }

    [Fact]
    public void Calcular_SessaoAtivaAlterada_GeraFingerprintDiferente()
    {
        var original = PlanejamentoSemanalDadosFingerprintService.Calcular(
            [CriarDemanda(1)],
            [CriarDisponibilidade()],
            [CriarSessao()]);

        var alterado = PlanejamentoSemanalDadosFingerprintService.Calcular(
            [CriarDemanda(1)],
            [CriarDisponibilidade()],
            [CriarSessao(new TimeOnly(10, 30))]);

        Assert.NotEqual(original, alterado);
    }

    [Fact]
    public void Calcular_SessaoConcluidaNaoAlteraFingerprint()
    {
        var original = PlanejamentoSemanalDadosFingerprintService.Calcular(
            [CriarDemanda(1)],
            [CriarDisponibilidade()],
            []);

        var concluida = CriarSessao();
        concluida.Situacao = SituacaoSessaoEstudo.Concluida;

        var comSessaoConcluida =
            PlanejamentoSemanalDadosFingerprintService.Calcular(
                [CriarDemanda(1)],
                [CriarDisponibilidade()],
                [concluida]);

        Assert.Equal(original, comSessaoConcluida);
    }
}