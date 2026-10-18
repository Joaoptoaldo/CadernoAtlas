using System.ComponentModel.DataAnnotations;

namespace CadernoAtlas.Api.Contracts.PlanejamentoSemanal;

public sealed record ConfirmarPlanejamentoSemanalRequest(
    [param: Required(
        ErrorMessage = "O início da semana é obrigatório.")]
    DateOnly? InicioSemana,

    [param: Required(
        ErrorMessage = "O instante original da prévia é obrigatório.")]
    DateTimeOffset? Agora,

    [param: Required]
    [param: StringLength(76, MinimumLength = 76)]
    [param: RegularExpression(
        @"^hmac-sha256:[0-9A-F]{64}$",
        ErrorMessage = "O identificador da proposta é inválido.")]
    string? PropostaId,

    [param: Required(
        ErrorMessage = "A lista de alocações é obrigatória.")]
    IReadOnlyList<AlocacaoPlanejamentoResponse>? Alocacoes);