using System.ComponentModel.DataAnnotations;

namespace CadernoAtlas.Api.Contracts.Cadernos;

public sealed class CriarCadernoRequest
{
    [Required]
    [StringLength(150, MinimumLength = 2)]
    public string Titulo { get; init; } = string.Empty;

    [StringLength(1000)]
    public string? Descricao { get; init; }
}