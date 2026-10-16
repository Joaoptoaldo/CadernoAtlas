using System.ComponentModel.DataAnnotations;
using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Contracts.TarefasDemanda;

public sealed class AtualizarTarefaDemandaRequest : IValidatableObject
{
    [Required]
    [StringLength(150)]
    public string Titulo { get; init; } = string.Empty;

    [StringLength(1000)]
    public string? Descricao { get; init; }

    [Range(0, int.MaxValue)]
    public int Ordem { get; init; }

    public SituacaoTarefaDemanda Situacao { get; init; }
        = SituacaoTarefaDemanda.Pendente;

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

        if (!Enum.IsDefined(typeof(SituacaoTarefaDemanda), Situacao))
        {
            yield return new ValidationResult(
                "A situação da tarefa informada é inválida.",
                new[] { nameof(Situacao) });
        }
    }
}