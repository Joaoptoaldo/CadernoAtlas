using System.ComponentModel.DataAnnotations;

namespace CadernoAtlas.Api.Contracts.PlanejamentoSemanal;

public sealed record PreviaPlanejamentoSemanalRequest(
    [param: Required] DateOnly? InicioSemana);
