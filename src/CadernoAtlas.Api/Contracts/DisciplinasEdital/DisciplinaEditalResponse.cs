namespace CadernoAtlas.Api.Contracts.DisciplinasEdital;

public sealed record DisciplinaEditalResponse(
    int Id,
    int ConcursoId,
    string Nome,
    int Ordem
  );