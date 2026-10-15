using System.ComponentModel.DataAnnotations;

namespace CadernoAtlas.Api.Contracts.Concursos;

/// <summary>
/// Request para criar um concurso e seus dados relacionados, como órgão, banca e datas importantes.
/// </summary>
public sealed class CriarConcursoRequest
{
    [Required]
    [StringLength(150)]
    public string Nome { get; init; } = string.Empty;

    [Required]
    [StringLength(150)]
    public string Orgao { get; init; } = string.Empty;

    [StringLength(100)]
    public string? Banca { get; init; }

    [StringLength(50)]
    public string? NumeroEdital { get; init; }

    public DateOnly? DataPublicacao { get; init; }

    public DateOnly? DataProva { get; init; }
}