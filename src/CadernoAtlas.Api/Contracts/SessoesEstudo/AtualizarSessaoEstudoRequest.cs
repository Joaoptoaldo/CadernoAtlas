using System.ComponentModel.DataAnnotations;

namespace CadernoAtlas.Api.Contracts.SessoesEstudo;

public sealed class AtualizarSessaoEstudoRequest : IValidatableObject
{
    [Required]
    [StringLength(150)]
    public string Titulo { get; init; } = string.Empty;

    [Required]
    public DateOnly? DataPlanejada { get; init; }

    [Required]
    public TimeOnly? HoraInicioPlanejada { get; init; }

    [Range(1, 1440)]
    public int DuracaoPlanejadaMinutos { get; init; }

    [Range(1, int.MaxValue)]
    public int? DemandaAcademicaId { get; init; }

    [Range(1, int.MaxValue)]
    public int? TarefaDemandaId { get; init; }

    [StringLength(1000)]
    public string? Observacoes { get; init; }

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(Titulo)
            || Titulo.Trim().Length < 2)
        {
            yield return new ValidationResult(
                "O título deve conter pelo menos 2 caracteres.",
                new[] { nameof(Titulo) });
        }

        if (DemandaAcademicaId.HasValue &&
            TarefaDemandaId.HasValue)
        {
            yield return new ValidationResult(
                "Informe uma demanda ou uma tarefa, não ambas.",
                new[]
                {
                    nameof(DemandaAcademicaId),
                    nameof(TarefaDemandaId)
                });
        }
    }
}
