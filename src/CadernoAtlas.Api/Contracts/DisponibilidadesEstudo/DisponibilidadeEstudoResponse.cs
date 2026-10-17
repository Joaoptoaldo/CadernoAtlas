namespace CadernoAtlas.Api.Contracts.DisponibilidadesEstudo;

public sealed record DisponibilidadeEstudoResponse(
    int Id,
    DateOnly Data,
    TimeOnly HoraInicio,
    TimeOnly HoraFim,
    DateTime CriadoEm
  );