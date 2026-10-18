using CadernoAtlas.Api.Contracts.PlanejamentoSemanal;
using CadernoAtlas.Api.Services;

namespace CadernoAtlas.Api.Tests;

public sealed class PlanejamentoSemanalPropostaIdServiceTests
{
    private const string FingerprintDados = "sha256:dados-originais";

    private static readonly DateOnly InicioSemana =
        new(2026, 10, 19);

    private static readonly DateTimeOffset Agora =
        new(2026, 10, 17, 12, 30, 0, TimeSpan.FromHours(-3));

    private static PlanejamentoSemanalPropostaIdService CriarServico(
        int deslocamentoChave = 0)
    {
        var chave = Enumerable
            .Range(0, 32)
            .Select(valor => (byte)(valor + deslocamentoChave))
            .ToArray();

        return new PlanejamentoSemanalPropostaIdService(
            Convert.ToBase64String(chave));
    }

    private static IReadOnlyCollection<AlocacaoPlanejamentoResponse>
        CriarAlocacoes(
            TimeOnly? horaInicio = null,
            int duracao = 60)
    {
        return
        [
            new AlocacaoPlanejamentoResponse(
                1,
                null,
                "Preparar prova",
                InicioSemana,
                horaInicio ?? new TimeOnly(9, 0),
                duracao)
        ];
    }

    [Fact]
    public void GerarPropostaId_MesmaEntrada_GeraMesmoIdentificador()
    {
        var servico = CriarServico();
        var alocacoes = CriarAlocacoes();

        var primeiro = servico.GerarPropostaId(
            InicioSemana, Agora, FingerprintDados, alocacoes);

        var segundo = servico.GerarPropostaId(
            InicioSemana, Agora, FingerprintDados, alocacoes);

        Assert.Equal(primeiro, segundo);

        Assert.True(servico.ValidarPropostaId(
            primeiro, InicioSemana, Agora, FingerprintDados, alocacoes));
    }

    [Fact]
    public void ValidarPropostaId_HorarioAlterado_RetornaFalse()
    {
        var servico = CriarServico();
        var original = CriarAlocacoes();

        var propostaId = servico.GerarPropostaId(
            InicioSemana, Agora, FingerprintDados, original);

        var alteradas = CriarAlocacoes(
            horaInicio: new TimeOnly(9, 1));

        Assert.False(servico.ValidarPropostaId(
            propostaId, InicioSemana, Agora, FingerprintDados, alteradas));
    }

    [Fact]
    public void ValidarPropostaId_DuracaoAlterada_RetornaFalse()
    {
        var servico = CriarServico();
        var original = CriarAlocacoes();

        var propostaId = servico.GerarPropostaId(
            InicioSemana, Agora, FingerprintDados, original);

        var alteradas = CriarAlocacoes(duracao: 45);

        Assert.False(servico.ValidarPropostaId(
            propostaId, InicioSemana, Agora, FingerprintDados, alteradas));
    }

    [Fact]
    public void ValidarPropostaId_AgoraAlterado_RetornaFalse()
    {
        var servico = CriarServico();
        var alocacoes = CriarAlocacoes();

        var propostaId = servico.GerarPropostaId(
            InicioSemana, Agora, FingerprintDados, alocacoes);

        Assert.False(servico.ValidarPropostaId(
            propostaId,
            InicioSemana,
            Agora.AddMinutes(1),
            FingerprintDados,
            alocacoes));
    }

    [Fact]
    public void ValidarPropostaId_DadosDeOrigemAlterados_RetornaFalse()
    {
        var servico = CriarServico();
        var alocacoes = CriarAlocacoes();

        var propostaId = servico.GerarPropostaId(
            InicioSemana, Agora, FingerprintDados, alocacoes);

        Assert.False(servico.ValidarPropostaId(
            propostaId,
            InicioSemana,
            Agora,
            "sha256:dados-alterados",
            alocacoes));
    }

    [Fact]
    public void ValidarPropostaId_ChaveDiferente_RetornaFalse()
    {
        var emissor = CriarServico();
        var outroServico = CriarServico(deslocamentoChave: 1);
        var alocacoes = CriarAlocacoes();

        var propostaId = emissor.GerarPropostaId(
            InicioSemana, Agora, FingerprintDados, alocacoes);

        Assert.False(outroServico.ValidarPropostaId(
            propostaId, InicioSemana, Agora, FingerprintDados, alocacoes));
    }

    [Fact]
    public void ValidarPropostaId_IdentificadorMalformado_RetornaFalse()
    {
        var servico = CriarServico();

        Assert.False(servico.ValidarPropostaId(
            "valor-invalido",
            InicioSemana,
            Agora,
            FingerprintDados,
            CriarAlocacoes()));
    }
}