using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Contracts.TarefasDemanda;

public sealed record TarefaDemandaResponse(
    int Id,
    int DemandaAcademicaId,
    string Titulo,
    string? Descricao,
    int Ordem,
    SituacaoTarefaDemanda Situacao
  );