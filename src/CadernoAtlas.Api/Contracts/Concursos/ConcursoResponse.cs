namespace CadernoAtlas.Api.Contracts.Concursos;

/// <summary>
/// Response para retornar os dados de um concurso, incluindo informações como órgão, banca, datas importantes e data de criação.
/// </summary>
public sealed record ConcursoResponse(
    int Id,
    string Nome,
    string Orgao,
    string? Banca,
    string? NumeroEdital,
    DateOnly? DataPublicacao,
    DateOnly? DataProva,
    DateTime CriadoEm
);