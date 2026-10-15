using System.ComponentModel.DataAnnotations;

namespace CadernoAtlas.Api.Contracts.DisciplinasEdital;

public sealed class AtualizarDisciplinaEditalRequest
{
    [Required]
    [StringLength(120, MinimumLength = 2)]
    public string Nome { get; init; } = string.Empty;

    public int Ordem { get; init; }
}