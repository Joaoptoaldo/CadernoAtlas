using System.Security.Cryptography;
using System.Text.Json;
using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Services;

public static class PlanejamentoSemanalDadosFingerprintService
{
    public static string Calcular(
        IEnumerable<DemandaAcademica> demandas,
        IEnumerable<DisponibilidadeEstudo> disponibilidades,
        IEnumerable<SessaoEstudo> sessoes)
    {
        ArgumentNullException.ThrowIfNull(demandas);
        ArgumentNullException.ThrowIfNull(disponibilidades);
        ArgumentNullException.ThrowIfNull(sessoes);

        var demandasCanonicas = demandas
            .Where(d => d.Situacao is
                SituacaoDemandaAcademica.Pendente or
                SituacaoDemandaAcademica.EmAndamento)
            .OrderBy(d => d.Id)
            .Select(d => new DemandaCanonica(
                d.Id,
                d.Titulo,
                d.Tipo,
                d.Prazo,
                d.Importancia,
                d.EsforcoEstimadoMinutos,
                d.Situacao,
                d.Tarefas
                    .OrderBy(t => t.Id)
                    .Select(t => new TarefaCanonica(
                        t.Id,
                        t.DemandaAcademicaId,
                        t.Titulo,
                        t.Ordem,
                        t.EsforcoEstimadoMinutos,
                        t.Situacao))
                    .ToArray()))
            .ToArray();

        var disponibilidadesCanonicas = disponibilidades
            .OrderBy(d => d.Data)
            .ThenBy(d => d.HoraInicio)
            .ThenBy(d => d.HoraFim)
            .Select(d => new DisponibilidadeCanonica(
                d.Data,
                d.HoraInicio,
                d.HoraFim))
            .ToArray();

        var sessoesCanonicas = sessoes
            .Where(s => s.Situacao is
                SituacaoSessaoEstudo.Planejada or
                SituacaoSessaoEstudo.EmAndamento)
            .OrderBy(s => s.DataPlanejada)
            .ThenBy(s => s.HoraInicioPlanejada)
            .ThenBy(s => s.DemandaAcademicaId)
            .ThenBy(s => s.TarefaDemandaId)
            .ThenBy(s => s.DuracaoPlanejadaMinutos)
            .Select(s => new SessaoCanonica(
                s.DataPlanejada,
                s.HoraInicioPlanejada,
                s.DuracaoPlanejadaMinutos,
                s.Situacao,
                s.DemandaAcademicaId,
                s.TarefaDemandaId))
            .ToArray();

        var snapshot = new SnapshotCanonico(
            demandasCanonicas,
            disponibilidadesCanonicas,
            sessoesCanonicas);

        var json = JsonSerializer.SerializeToUtf8Bytes(snapshot);
        var hash = SHA256.HashData(json);

        return $"sha256:{Convert.ToHexString(hash)}";
    }

    private sealed record SnapshotCanonico(
        IReadOnlyList<DemandaCanonica> Demandas,
        IReadOnlyList<DisponibilidadeCanonica> Disponibilidades,
        IReadOnlyList<SessaoCanonica> Sessoes);

    private sealed record DemandaCanonica(
        int Id,
        string Titulo,
        TipoDemandaAcademica Tipo,
        DateOnly? Prazo,
        ImportanciaDemandaAcademica Importancia,
        int? EsforcoEstimadoMinutos,
        SituacaoDemandaAcademica Situacao,
        IReadOnlyList<TarefaCanonica> Tarefas);

    private sealed record TarefaCanonica(
        int Id,
        int DemandaAcademicaId,
        string Titulo,
        int Ordem,
        int? EsforcoEstimadoMinutos,
        SituacaoTarefaDemanda Situacao);

    private sealed record DisponibilidadeCanonica(
        DateOnly Data,
        TimeOnly HoraInicio,
        TimeOnly HoraFim);

    private sealed record SessaoCanonica(
        DateOnly DataPlanejada,
        TimeOnly HoraInicioPlanejada,
        int DuracaoPlanejadaMinutos,
        SituacaoSessaoEstudo Situacao,
        int? DemandaAcademicaId,
        int? TarefaDemandaId);
}