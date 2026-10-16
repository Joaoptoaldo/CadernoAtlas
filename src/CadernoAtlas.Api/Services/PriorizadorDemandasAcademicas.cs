using CadernoAtlas.Api.Contracts.DemandasAcademicas;
using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Services;

public static class PriorizadorDemandasAcademicas
{
    public static DateOnly ObterDataNoFuso(
        DateTime instanteUtc,
        TimeZoneInfo fusoHorario)
    {
        var utc = instanteUtc.Kind switch
        {
            DateTimeKind.Utc => instanteUtc,
            DateTimeKind.Local => instanteUtc.ToUniversalTime(),
            _ => DateTime.SpecifyKind(instanteUtc, DateTimeKind.Utc)
        };

        return DateOnly.FromDateTime(
            TimeZoneInfo.ConvertTimeFromUtc(utc, fusoHorario));
    }

    public static DateOnly ObterDataNoFuso(
        DateTimeOffset instanteUtc,
        TimeZoneInfo fusoHorario)
    {
        return ObterDataNoFuso(instanteUtc.UtcDateTime, fusoHorario);
    }

    public static IReadOnlyList<DemandaAcademicaPrioridadeResponse> Priorizar(
        IEnumerable<DemandaAcademicaResponse> demandas,
        DateOnly hoje)
    {
        return demandas
            .Where(d =>
                d.Situacao == SituacaoDemandaAcademica.Pendente ||
                d.Situacao == SituacaoDemandaAcademica.EmAndamento)
            .Select(d => CriarResultado(d, hoje))
            .OrderBy(d => d.OrdemUrgencia)
            .ThenBy(d => d.Resposta.Demanda.Prazo ?? DateOnly.MaxValue)
            .ThenByDescending(d => d.Resposta.Demanda.Importancia)
            .ThenBy(d =>
                d.Resposta.Demanda.Situacao ==
                SituacaoDemandaAcademica.EmAndamento ? 0 : 1)
            .ThenBy(
                d => d.Resposta.Demanda.Titulo,
                StringComparer.OrdinalIgnoreCase)
            .ThenBy(d => d.Resposta.Demanda.Id)
            .Select(d => d.Resposta)
            .ToList();
    }

    private static DemandaPriorizada CriarResultado(
        DemandaAcademicaResponse demanda,
        DateOnly hoje)
    {
        int? diasAtePrazo = demanda.Prazo.HasValue
            ? demanda.Prazo.Value.DayNumber - hoje.DayNumber
            : null;

        var (faixaUrgencia, ordemUrgencia) =
            ClassificarPrazo(demanda.Prazo, hoje);

        var resposta = new DemandaAcademicaPrioridadeResponse(
            demanda,
            faixaUrgencia,
            diasAtePrazo,
            CriarJustificativa(demanda, diasAtePrazo));

        return new DemandaPriorizada(resposta, ordemUrgencia);
    }

    private static (string Faixa, int Ordem) ClassificarPrazo(
        DateOnly? prazo,
        DateOnly hoje)
    {
        if (!prazo.HasValue)
            return ("Sem prazo definido", 6);

        int dias = prazo.Value.DayNumber - hoje.DayNumber;

        if (dias < 0)
            return ("Atrasada", 0);

        if (dias == 0)
            return ("Vence hoje", 1);

        if (dias <= 3)
            return ("Até 3 dias", 2);

        if (dias <= 7)
            return ("Até 7 dias", 3);

        if (dias <= 14)
            return ("Até 14 dias", 4);

        return ("Prazo distante", 5);
    }

    private static string CriarJustificativa(
        DemandaAcademicaResponse demanda,
        int? diasAtePrazo)
    {
        string descricaoPrazo;

        if (!diasAtePrazo.HasValue)
        {
            descricaoPrazo = "Sem prazo definido";
        }
        else if (diasAtePrazo.Value < 0)
        {
            int diasVencidos = Math.Abs(diasAtePrazo.Value);
            string unidade = diasVencidos == 1 ? "dia" : "dias";

            descricaoPrazo =
                $"Prazo vencido há {diasVencidos} {unidade}";
        }
        else if (diasAtePrazo.Value == 0)
        {
            descricaoPrazo = "Prazo para hoje";
        }
        else if (diasAtePrazo.Value == 1)
        {
            descricaoPrazo = "Prazo para amanhã";
        }
        else
        {
            descricaoPrazo = $"Prazo em {diasAtePrazo.Value} dias";
        }

        string importancia = demanda.Importancia switch
        {
            ImportanciaDemandaAcademica.Alta => "alta",
            ImportanciaDemandaAcademica.Media => "média",
            ImportanciaDemandaAcademica.Baixa => "baixa",
            _ => "não definida"
        };

        string situacao = demanda.Situacao switch
        {
            SituacaoDemandaAcademica.Pendente => "pendente",
            SituacaoDemandaAcademica.EmAndamento => "em andamento",
            _ => "não definida"
        };

        return $"{descricaoPrazo}; importância {importancia}; " +
               $"situação {situacao}.";
    }

    private sealed record DemandaPriorizada(
        DemandaAcademicaPrioridadeResponse Resposta,
        int OrdemUrgencia);
}