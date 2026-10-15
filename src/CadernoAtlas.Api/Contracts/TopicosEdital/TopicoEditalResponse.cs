namespace CadernoAtlas.Api.Contracts.TopicosEdital;

public sealed record TopicoEditalResponse(
    int Id,
    int DisciplinaEditalId,
    int? TopicoPaiId,
    string Descricao,
    int Ordem,
    string Status
  );