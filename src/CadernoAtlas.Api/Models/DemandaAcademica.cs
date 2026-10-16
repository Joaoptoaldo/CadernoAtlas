namespace CadernoAtlas.Api.Models;

public class DemandaAcademica
{
    public int Id { get; set; }

    public string Titulo { get; set; } = string.Empty;

    public string? Descricao { get; set; }

    public TipoDemandaAcademica Tipo { get; set; }
        = TipoDemandaAcademica.Outro;

    public DateOnly? Prazo { get; set; }

    public ImportanciaDemandaAcademica Importancia { get; set; }
        = ImportanciaDemandaAcademica.Media;

    public int? EsforcoEstimadoMinutos { get; set; }

    public SituacaoDemandaAcademica Situacao { get; set; }
        = SituacaoDemandaAcademica.Pendente;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public ICollection<TarefaDemanda> Tarefas { get; set; }
        = new List<TarefaDemanda>();
}