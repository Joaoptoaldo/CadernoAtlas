using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Contracts.SessoesEstudo;

public sealed record SessaoEstudoResponse(
    int Id,
    string Titulo,
    DateOnly DataPlanejada,
    TimeOnly HoraInicioPlanejada,
    int DuracaoPlanejadaMinutos,
    int? DuracaoRealMinutos,
    SituacaoSessaoEstudo Situacao,
    int? DemandaAcademicaId,
    int? TarefaDemandaId,
    string? Observacoes,
    DateTime CriadoEm,
    DateTime? InicioRealEm,
    DateTime? ConcluidaEm,
    DateTime? CanceladaEm
  );
