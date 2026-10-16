using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Contracts.DemandasAcademicas;

public sealed record DemandaAcademicaResponse(
    int Id,
    string Titulo,
    string? Descricao,
    TipoDemandaAcademica Tipo,
    DateOnly? Prazo,
    ImportanciaDemandaAcademica Importancia,
    int? EsforcoEstimadoMinutos,
    SituacaoDemandaAcademica Situacao,
    DateTime CriadoEm
  );