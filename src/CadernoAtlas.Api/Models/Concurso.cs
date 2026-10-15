namespace CadernoAtlas.Api.Models;

public class Concurso
{
    public int Id { get; set; }

    public string Nome { get; set; } = string.Empty;

    public string Orgao { get; set; } = string.Empty;

    public string? Banca { get; set; }

    public string? NumeroEdital { get; set; }

    public DateOnly? DataPublicacao { get; set; }

    public DateOnly? DataProva { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public ICollection<DisciplinaEdital> Disciplinas { get; set; }
        = new List<DisciplinaEdital>();
}