namespace CadernoAtlas.Api.Models;

public class SessaoEstudo
{
    public int Id { get; set; }

    public string Titulo { get; set; } = string.Empty;

    public DateOnly DataPlanejada { get; set; }

    public TimeOnly HoraInicioPlanejada { get; set; }

    public int DuracaoPlanejadaMinutos { get; set; }

    public int? DuracaoRealMinutos { get; set; }

    public SituacaoSessaoEstudo Situacao { get; set; } =
        SituacaoSessaoEstudo.Planejada;

    public int? DemandaAcademicaId { get; set; }

    public DemandaAcademica? DemandaAcademica { get; set; }

    public int? TarefaDemandaId { get; set; }

    public TarefaDemanda? TarefaDemanda { get; set; }

    public string? Observacoes { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public DateTime? InicioRealEm { get; set; }

    public DateTime? ConcluidaEm { get; set; }

    public DateTime? CanceladaEm { get; set; }
}
