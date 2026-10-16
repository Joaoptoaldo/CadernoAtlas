using System.ComponentModel.DataAnnotations;

namespace CadernoAtlas.Api.Contracts.TarefasDemanda;

public sealed class CriarTarefaDemandaRequest : IValidatableObject
{
    [Required]
    [StringLength(150)]
    public string Titulo { get; init; } = string.Empty;

    [StringLength(1000)]
    public string? Descricao { get; init; }

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(Titulo)
            || Titulo.Trim().Length < 2)
        {
            yield return new ValidationResult(
                "O título deve ter pelo menos 2 caracteres.",
                new[] { nameof(Titulo) });
        }
    }
}