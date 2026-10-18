namespace CadernoAtlas.Api.Services;

public sealed record PlanejarSemanaRequest(
    DateOnly InicioSemana,
    DateTimeOffset Agora
  );