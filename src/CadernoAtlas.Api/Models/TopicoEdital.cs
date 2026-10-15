namespace CadernoAtlas.Api.Models;

public class TopicoEdital
{
    public int Id { get; set; }

    public int DisciplinaEditalId { get; set; }

    public DisciplinaEdital DisciplinaEdital { get; set; } = null!;

    public int? TopicoPaiId { get; set; }

    public TopicoEdital? TopicoPai { get; set; }

    public ICollection<TopicoEdital> Subtopicos { get; set; }
        = new List<TopicoEdital>();

    public string Descricao { get; set; } = string.Empty;

    public int Ordem { get; set; }

    public StatusTopicoEdital Status { get; set; }
        = StatusTopicoEdital.Pendente;
}