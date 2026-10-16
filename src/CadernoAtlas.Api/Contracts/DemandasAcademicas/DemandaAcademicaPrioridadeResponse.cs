namespace CadernoAtlas.Api.Contracts.DemandasAcademicas;

public sealed record DemandaAcademicaPrioridadeResponse(
    DemandaAcademicaResponse Demanda,
    string FaixaUrgencia,
    int? DiasAtePrazo,
    string Justificativa
  );