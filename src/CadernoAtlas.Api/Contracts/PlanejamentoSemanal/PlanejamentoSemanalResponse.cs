namespace CadernoAtlas.Api.Contracts.PlanejamentoSemanal;

public sealed record PlanejamentoSemanalResponse(
    DateOnly InicioSemana,
    DateTimeOffset Agora,
    IReadOnlyList<AlocacaoPlanejamentoResponse> Alocacoes,
    IReadOnlyList<AtividadeNaoAlocadaResponse> NaoAlocadas)
  {
      public string PropostaId { get; init; } = string.Empty;
  }

public sealed record AlocacaoPlanejamentoResponse(
    int? DemandaAcademicaId,
    int? TarefaDemandaId,
    string Titulo,
    DateOnly DataPlanejada,
    TimeOnly HoraInicio,
    int DuracaoPlanejadaMinutos);

public sealed record AtividadeNaoAlocadaResponse(
    int? DemandaAcademicaId,
    int? TarefaDemandaId,
    string Titulo,
    MotivoNaoAlocacao Motivo,
    string Descricao);

public enum MotivoNaoAlocacao
{
    EstimativaAusente,
    EstimativaInvalida,
    SemDisponibilidadeNaSemana,
    DuracaoMaiorQueQualquerDisponibilidade,
    HorarioOcupadoPorSessaoExistente,
    CapacidadeConsumidaPorAtividadesPrioritarias
}