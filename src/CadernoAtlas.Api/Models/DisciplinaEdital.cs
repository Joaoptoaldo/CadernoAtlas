namespace CadernoAtlas.Api.Models;

public class DisciplinaEdital
{
    public int Id { get; set; }

    public int ConcursoId { get; set; }

    public Concurso Concurso { get; set; } = null!;

    public string Nome { get; set; } = string.Empty;

    public int Ordem { get; set; }

    public ICollection<TopicoEdital> Topicos { get; set; }
        = new List<TopicoEdital>();
}