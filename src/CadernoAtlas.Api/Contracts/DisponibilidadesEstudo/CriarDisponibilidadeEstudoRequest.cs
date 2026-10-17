using System.ComponentModel.DataAnnotations;

namespace CadernoAtlas.Api.Contracts.DisponibilidadesEstudo;

public sealed class CriarDisponibilidadeEstudoRequest : IValidatableObject
{
    [Required]
    public DateOnly? Data { get; init; }

    [Required]
    public TimeOnly? HoraInicio { get; init; }

    [Required]
    public TimeOnly? HoraFim { get; init; }

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (HoraInicio is TimeOnly inicio
            && HoraFim is TimeOnly fim
            && fim <= inicio)
        {
            yield return new ValidationResult(
                "O horário final deve ser posterior ao horário inicial.",
                new[]
                {
                    nameof(HoraInicio),
                    nameof(HoraFim)
                });
        }
    }
}