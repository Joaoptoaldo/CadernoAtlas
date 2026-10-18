using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CadernoAtlas.Api.Contracts.PlanejamentoSemanal;

namespace CadernoAtlas.Api.Services;

public sealed class PlanejamentoSemanalPropostaIdService
{
    private const string Prefixo = "hmac-sha256:";

    private readonly byte[] _chave;

    private static readonly JsonSerializerOptions OpcoesJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public PlanejamentoSemanalPropostaIdService(string chaveBase64)
    {
        if (string.IsNullOrWhiteSpace(chaveBase64))
        {
            throw new ArgumentException(
                "A chave de assinatura é obrigatória.",
                nameof(chaveBase64));
        }

        try
        {
            _chave = Convert.FromBase64String(chaveBase64);
        }
        catch (FormatException ex)
        {
            throw new ArgumentException(
                "A chave de assinatura deve estar em Base64.",
                nameof(chaveBase64),
                ex);
        }

        if (_chave.Length < 32)
        {
            throw new ArgumentException(
                "A chave deve conter pelo menos 32 bytes.",
                nameof(chaveBase64));
        }
    }

    public string GerarPropostaId(
        DateOnly inicioSemana,
        DateTimeOffset agora,
        string fingerprintDados,
        IReadOnlyCollection<AlocacaoPlanejamentoResponse> alocacoes)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(fingerprintDados);
        ArgumentNullException.ThrowIfNull(alocacoes);

        var alocacoesCanonicas = alocacoes
            .Select(alocacao => new AlocacaoCanonica(
                alocacao.DemandaAcademicaId,
                alocacao.TarefaDemandaId,
                alocacao.Titulo,
                alocacao.DataPlanejada.ToString(
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture),
                alocacao.HoraInicio.ToString(
                    "HH:mm:ss.fffffff",
                    CultureInfo.InvariantCulture),
                alocacao.DuracaoPlanejadaMinutos))
            .OrderBy(a => a.DataPlanejada, StringComparer.Ordinal)
            .ThenBy(a => a.HoraInicio, StringComparer.Ordinal)
            .ThenBy(a => a.DemandaAcademicaId)
            .ThenBy(a => a.TarefaDemandaId)
            .ThenBy(a => a.Titulo, StringComparer.Ordinal)
            .ThenBy(a => a.DuracaoPlanejadaMinutos)
            .ToArray();

        var payload = new PayloadCanonico(
            inicioSemana.ToString(
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture),
            agora.ToUniversalTime().ToString(
                "O",
                CultureInfo.InvariantCulture),
            fingerprintDados,
            alocacoesCanonicas);

        var conteudo = JsonSerializer.SerializeToUtf8Bytes(
            payload,
            OpcoesJson);

        var assinatura = HMACSHA256.HashData(_chave, conteudo);

        return Prefixo + Convert.ToHexString(assinatura);
    }

    public bool ValidarPropostaId(
        string? propostaId,
        DateOnly inicioSemana,
        DateTimeOffset agora,
        string fingerprintDados,
        IReadOnlyCollection<AlocacaoPlanejamentoResponse> alocacoes)
    {
        if (string.IsNullOrWhiteSpace(propostaId) ||
            !propostaId.StartsWith(Prefixo, StringComparison.Ordinal))
        {
            return false;
        }

        byte[] assinaturaRecebida;

        try
        {
            assinaturaRecebida = Convert.FromHexString(
                propostaId[Prefixo.Length..]);
        }
        catch (FormatException)
        {
            return false;
        }

        if (assinaturaRecebida.Length != 32)
        {
            return false;
        }

        var assinaturaEsperada = Convert.FromHexString(
            GerarPropostaId(
                inicioSemana,
                agora,
                fingerprintDados,
                alocacoes)[Prefixo.Length..]);

        return CryptographicOperations.FixedTimeEquals(
            assinaturaRecebida,
            assinaturaEsperada);
    }

    private sealed record PayloadCanonico(
        string InicioSemana,
        string AgoraUtc,
        string FingerprintDados,
        IReadOnlyList<AlocacaoCanonica> Alocacoes);

    private sealed record AlocacaoCanonica(
        int? DemandaAcademicaId,
        int? TarefaDemandaId,
        string Titulo,
        string DataPlanejada,
        string HoraInicio,
        int DuracaoPlanejadaMinutos);
}