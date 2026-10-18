namespace CadernoAtlas.Api.Models;

public class TarefaDemanda
{
    public int Id { get; set; }

    public int DemandaAcademicaId { get; set; }

    public DemandaAcademica DemandaAcademica { get; set; }
        = null!;

    public string Titulo { get; set; } = string.Empty;

    public string? Descricao { get; set; }

    public int Ordem { get; set; }

    public int? EsforcoEstimadoMinutos { get; set; }

    public SituacaoTarefaDemanda Situacao { get; set; }
        = SituacaoTarefaDemanda.Pendente;
}