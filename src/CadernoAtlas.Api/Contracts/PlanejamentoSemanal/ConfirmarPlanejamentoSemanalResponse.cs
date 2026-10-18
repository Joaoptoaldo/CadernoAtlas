using CadernoAtlas.Api.Contracts.SessoesEstudo;

namespace CadernoAtlas.Api.Contracts.PlanejamentoSemanal;

public sealed record ConfirmarPlanejamentoSemanalResponse(
    DateOnly InicioSemana,
    DateTimeOffset Agora,
    IReadOnlyList<SessaoEstudoResponse> SessoesCriadas
  );