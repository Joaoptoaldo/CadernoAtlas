
using System.ComponentModel.DataAnnotations;

namespace CadernoAtlas.Api.Contracts.Concursos;

/// <summary>
/// DTO para atualizar os dados de um concurso existente, incluindo informações como órgão, banca e datas importantes.
/// </summary>
public class AtualizarConcursoRequest
{
    [Required]
    [StringLength(150, MinimumLength = 2)]
    public string Nome { get; set; } = string.Empty;

    [Required]
    [StringLength(150, MinimumLength = 2)]
    public string Orgao { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Banca { get; set; }

    [StringLength(50)]
    public string? NumeroEdital { get; set; }

    public DateOnly? DataPublicacao { get; set; }

    public DateOnly? DataProva { get; set; }
}
