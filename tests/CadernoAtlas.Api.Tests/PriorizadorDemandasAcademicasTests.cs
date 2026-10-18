using CadernoAtlas.Api.Contracts.DemandasAcademicas;
using CadernoAtlas.Api.Models;
using CadernoAtlas.Api.Services;

namespace CadernoAtlas.Api.Tests;

public class PriorizadorDemandasAcademicasTests
{
    [Fact]
    public void Priorizar_MesmaFaixaEPrazo_AplicaTodosOsDesempates()
    {
        // Arrange
        var hoje = new DateOnly(2026, 10, 19);
        var prazo = hoje.AddDays(2);

        var demandas = new[]
        {
            CriarDemanda(
                6, "Zeta",
                ImportanciaDemandaAcademica.Alta,
                SituacaoDemandaAcademica.EmAndamento,
                prazo),

            CriarDemanda(
                4, "Beta",
                ImportanciaDemandaAcademica.Media,
                SituacaoDemandaAcademica.EmAndamento,
                prazo),

            CriarDemanda(
                3, "alfa",
                ImportanciaDemandaAcademica.Alta,
                SituacaoDemandaAcademica.EmAndamento,
                prazo),

            CriarDemanda(
                2, "Alfa",
                ImportanciaDemandaAcademica.Alta,
                SituacaoDemandaAcademica.EmAndamento,
                prazo),

            CriarDemanda(
                1, "Aardvark",
                ImportanciaDemandaAcademica.Alta,
                SituacaoDemandaAcademica.Pendente,
                prazo),

            CriarDemanda(
                5, "Beta",
                ImportanciaDemandaAcademica.Alta,
                SituacaoDemandaAcademica.EmAndamento,
                prazo),

            CriarDemanda(
                7, "Outra",
                ImportanciaDemandaAcademica.Baixa,
                SituacaoDemandaAcademica.Pendente,
                prazo)
        };

        // Act
        var resultado =
            PriorizadorDemandasAcademicas.Priorizar(demandas, hoje);

        // Assert
        Assert.Equal(
            new[] { 2, 3, 5, 6, 1, 4, 7 },
            resultado.Select(item => item.Demanda.Id));
    }

    [Fact]
    public void Priorizar_MesmaFaixaComPrazosDiferentes_UsaPrazoMaisProximo()
    {
        // Arrange
        var hoje = new DateOnly(2026, 10, 19);

        var demandas = new[]
        {
            CriarDemanda(
                1, "A - prazo posterior",
                ImportanciaDemandaAcademica.Alta,
                SituacaoDemandaAcademica.Pendente,
                hoje.AddDays(3)),

            CriarDemanda(
                2, "Z - prazo anterior",
                ImportanciaDemandaAcademica.Alta,
                SituacaoDemandaAcademica.Pendente,
                hoje.AddDays(1))
        };

        // Act
        var resultado =
            PriorizadorDemandasAcademicas.Priorizar(demandas, hoje);

        // Assert
        Assert.Equal(
            new[] { 2, 1 },
            resultado.Select(item => item.Demanda.Id));
    }

    private static DemandaAcademicaResponse CriarDemanda(
        int id,
        string titulo,
        ImportanciaDemandaAcademica importancia,
        SituacaoDemandaAcademica situacao,
        DateOnly? prazo)
    {
        return new DemandaAcademicaResponse(
            id,
            titulo,
            null,
            TipoDemandaAcademica.Trabalho,
            prazo,
            importancia,
            30,
            situacao,
            new DateTime(
                2026, 10, 1, 12, 0, 0, DateTimeKind.Utc));
    }
}