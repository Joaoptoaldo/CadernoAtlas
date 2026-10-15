namespace CadernoAtlas.Api.Contracts.Cadernos;

public sealed record CadernoResponse(
    int Id,
    string Titulo,
    string? Descricao,
    DateTime CriadoEm
);