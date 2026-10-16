using System.ComponentModel.DataAnnotations;
using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Contracts.DemandasAcademicas;

public sealed class CriarDemandaAcademicaRequest : IValidatableObject
{
    [Required]
    [StringLength(150)]
    public string Titulo { get; init; } = string.Empty;

    [StringLength(1000)]
    public string? Descricao { get; init; }

    public TipoDemandaAcademica Tipo { get; init; }
        = TipoDemandaAcademica.Outro;

    public DateOnly? Prazo { get; init; }

    public ImportanciaDemandaAcademica Importancia { get; init; }
        = ImportanciaDemandaAcademica.Media;

    [Range(0, int.MaxValue)]
    public int? EsforcoEstimadoMinutos { get; init; }

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

        if (!Enum.IsDefined(typeof(TipoDemandaAcademica), Tipo))
        {
            yield return new ValidationResult(
                "O tipo de demanda informado é inválido.",
                new[] { nameof(Tipo) });
        }

        if (!Enum.IsDefined(
            typeof(ImportanciaDemandaAcademica),
            Importancia))
        {
            yield return new ValidationResult(
                "A importância informada é inválida.",
                new[] { nameof(Importancia) });
        }
    }
}