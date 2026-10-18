using CadernoAtlas.Api.Contracts.DemandasAcademicas;
using CadernoAtlas.Api.Contracts.PlanejamentoSemanal;
using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Services;

/// <summary>
/// PlanejadorSemanal é responsável por alocar atividades em intervalos de tempo disponíveis durante uma semana, considerando demandas acadêmicas, disponibilidades de estudo e sessões de estudo existentes. Ele prioriza as atividades com base em critérios definidos e retorna um planejamento semanal detalhado, incluindo alocações bem-sucedidas e atividades não alocadas com motivos específicos.
/// </summary>
public sealed class PlanejadorSemanal
{
    private const int MinutosPorDia = 24 * 60;
    private static readonly long TicksPorMinuto =
        TimeSpan.TicksPerMinute;

    private readonly TimeZoneInfo _fusoHorario;

    public PlanejadorSemanal(TimeZoneInfo fusoHorario)
    {
        _fusoHorario = fusoHorario;
    }

    public PlanejamentoSemanalResponse Planejar(
        PlanejarSemanaRequest request,
        IEnumerable<DemandaAcademica> demandas,
        IEnumerable<DisponibilidadeEstudo> disponibilidades,
        IEnumerable<SessaoEstudo> sessoesExistentes)
    {
        if (request.InicioSemana.DayOfWeek != DayOfWeek.Monday)
        {
            throw new ArgumentException(
                "O início da semana deve ser uma segunda-feira.",
                nameof(request));
        }

        var demandasLista = demandas.ToList();
        var disponibilidadesLista = disponibilidades.ToList();

        var sessoesQueReservamHorario = sessoesExistentes
            .Where(sessao =>
                sessao.Situacao is
                    SituacaoSessaoEstudo.Planejada or
                    SituacaoSessaoEstudo.EmAndamento)
            .ToList();

        var agoraLocal = TimeZoneInfo.ConvertTime(
            request.Agora,
            _fusoHorario);

        var hojeLocal = DateOnly.FromDateTime(
            agoraLocal.DateTime);

        var minutoCorte = ArredondarMinutoInicial(
            TimeOnly.FromDateTime(agoraLocal.DateTime));

        var datasSemana = Enumerable
            .Range(0, 7)
            .Select(dias => request.InicioSemana.AddDays(dias))
            .ToList();

        var intervalosDisponiveis = CriarIntervalosDisponiveis(
            datasSemana,
            hojeLocal,
            minutoCorte,
            disponibilidadesLista);

        var intervalosLivresAposSessoes =
            ClonarIntervalos(intervalosDisponiveis);

        foreach (var data in datasSemana)
        {
            var intervalos = intervalosLivresAposSessoes[data];

            foreach (var sessao in sessoesQueReservamHorario)
            {
                var ocupado = ObterIntervaloOcupadoNoDia(sessao, data);

                if (ocupado is not null)
                {
                    intervalos = SubtrairIntervalo(intervalos, ocupado);
                }
            }

            intervalosLivresAposSessoes[data] = intervalos;
        }

        var intervalosLivres =
            ClonarIntervalos(intervalosLivresAposSessoes);

        var demandasAtivas = demandasLista
            .Where(demanda =>
                demanda.Situacao == SituacaoDemandaAcademica.Pendente ||
                demanda.Situacao == SituacaoDemandaAcademica.EmAndamento)
            .ToList();

        var prioridades = PriorizadorDemandasAcademicas.Priorizar(
                demandasAtivas.Select(ParaResposta),
                hojeLocal)
            .Select((item, indice) => new
            {
                DemandaId = item.Demanda.Id,
                Ordem = indice
            })
            .ToDictionary(
                item => item.DemandaId,
                item => item.Ordem);

        var demandasComSessaoAtiva = sessoesQueReservamHorario
            .Where(sessao => sessao.DemandaAcademicaId.HasValue)
            .Select(sessao => sessao.DemandaAcademicaId!.Value)
            .ToHashSet();

        var tarefasComSessaoAtiva = sessoesQueReservamHorario
            .Where(sessao => sessao.TarefaDemandaId.HasValue)
            .Select(sessao => sessao.TarefaDemandaId!.Value)
            .ToHashSet();

        var atividades = CriarAtividades(
            demandasAtivas,
            prioridades,
            demandasComSessaoAtiva,
            tarefasComSessaoAtiva);

        var alocacoes = new List<AlocacaoPlanejamentoResponse>();
        var naoAlocadas = new List<AtividadeNaoAlocadaResponse>();

        foreach (var atividade in atividades)
        {
            if (!atividade.DuracaoMinutos.HasValue)
            {
                naoAlocadas.Add(CriarNaoAlocada(
                    atividade,
                    MotivoNaoAlocacao.EstimativaAusente));

                continue;
            }

            var duracao = atividade.DuracaoMinutos.Value;

            if (duracao <= 0)
            {
                naoAlocadas.Add(CriarNaoAlocada(
                    atividade,
                    MotivoNaoAlocacao.EstimativaInvalida));

                continue;
            }

            var lugar = EncontrarPrimeiroIntervalo(
                datasSemana,
                intervalosLivres,
                duracao);

            if (lugar is null)
            {
                var motivo = DeterminarMotivo(
                    duracao,
                    intervalosDisponiveis,
                    intervalosLivresAposSessoes);

                naoAlocadas.Add(CriarNaoAlocada(
                    atividade,
                    motivo));

                continue;
            }

            var intervaloEncontrado = lugar.Value.Intervalo;
            var inicioMinuto = intervaloEncontrado.InicioMinuto;
            var fimMinuto = inicioMinuto + duracao;

            alocacoes.Add(new AlocacaoPlanejamentoResponse(
                atividade.DemandaAcademicaId,
                atividade.TarefaDemandaId,
                atividade.Titulo,
                lugar.Value.Data,
                TimeOnly.FromTimeSpan(
                    TimeSpan.FromMinutes(inicioMinuto)),
                duracao));

            ConsumirIntervalo(
                intervalosLivres[lugar.Value.Data],
                lugar.Value.Indice,
                intervaloEncontrado,
                fimMinuto);
        }

        return new PlanejamentoSemanalResponse(
            request.InicioSemana,
            request.Agora,
            alocacoes,
            naoAlocadas);
    }

    private static List<Atividade> CriarAtividades(
        IReadOnlyCollection<DemandaAcademica> demandas,
        IReadOnlyDictionary<int, int> prioridades,
        IReadOnlySet<int> demandasComSessaoAtiva,
        IReadOnlySet<int> tarefasComSessaoAtiva)
    {
        var atividades = new List<Atividade>();

        foreach (var demanda in demandas
                     .OrderBy(item => prioridades[item.Id]))
        {
            if (demanda.Tarefas.Count == 0)
            {
                if (demandasComSessaoAtiva.Contains(demanda.Id))
                {
                    continue;
                }

                atividades.Add(new Atividade(
                    demanda.Id,
                    null,
                    demanda.Titulo,
                    demanda.EsforcoEstimadoMinutos));

                continue;
            }

            foreach (var tarefa in demanda.Tarefas
                         .Where(item =>
                             item.Situacao == SituacaoTarefaDemanda.Pendente ||
                             item.Situacao == SituacaoTarefaDemanda.EmAndamento)
                         .OrderBy(item => item.Ordem)
                         .ThenBy(item => item.Id))
            {
                if (tarefasComSessaoAtiva.Contains(tarefa.Id))
                {
                    continue;
                }

                atividades.Add(new Atividade(
                    null,
                    tarefa.Id,
                    tarefa.Titulo,
                    tarefa.EsforcoEstimadoMinutos));
            }
        }

        return atividades;
    }

    private static Dictionary<DateOnly, List<Intervalo>>
        CriarIntervalosDisponiveis(
            IReadOnlyCollection<DateOnly> datasSemana,
            DateOnly hojeLocal,
            int minutoCorte,
            IReadOnlyCollection<DisponibilidadeEstudo> disponibilidades)
    {
        var resultado = new Dictionary<DateOnly, List<Intervalo>>();

        foreach (var data in datasSemana)
        {
            var intervalos = new List<Intervalo>();

            if (data >= hojeLocal)
            {
                foreach (var disponibilidade in disponibilidades
                             .Where(item => item.Data == data))
                {
                    var inicio = ArredondarMinutoInicial(
                        disponibilidade.HoraInicio);

                    var fim = ArredondarMinutoFinal(
                        disponibilidade.HoraFim);

                    if (data == hojeLocal)
                    {
                        inicio = Math.Max(inicio, minutoCorte);
                    }

                    if (inicio < fim)
                    {
                        intervalos.Add(new Intervalo(inicio, fim));
                    }
                }
            }

            resultado[data] = MesclarIntervalos(intervalos);
        }

        return resultado;
    }

    private static List<Intervalo> MesclarIntervalos(
        IEnumerable<Intervalo> intervalos)
    {
        var ordenados = intervalos
            .OrderBy(item => item.InicioMinuto)
            .ThenBy(item => item.FimMinuto)
            .ToList();

        var resultado = new List<Intervalo>();

        foreach (var atual in ordenados)
        {
            if (resultado.Count == 0)
            {
                resultado.Add(atual);
                continue;
            }

            var anterior = resultado[^1];

            if (atual.InicioMinuto <= anterior.FimMinuto)
            {
                resultado[^1] = new Intervalo(
                    anterior.InicioMinuto,
                    Math.Max(anterior.FimMinuto, atual.FimMinuto));
            }
            else
            {
                resultado.Add(atual);
            }
        }

        return resultado;
    }

    private static Dictionary<DateOnly, List<Intervalo>>
        ClonarIntervalos(
            IReadOnlyDictionary<DateOnly, List<Intervalo>> origem)
    {
        return origem.ToDictionary(
            item => item.Key,
            item => item.Value.ToList());
    }

    private static Intervalo? ObterIntervaloOcupadoNoDia(
        SessaoEstudo sessao,
        DateOnly data)
    {
        if (sessao.DuracaoPlanejadaMinutos <= 0)
        {
            return null;
        }

        var diaInicialAbsoluto =
            (long)sessao.DataPlanejada.DayNumber * MinutosPorDia;

        var inicioNoDia = sessao.HoraInicioPlanejada.Ticks /
                          TicksPorMinuto;

        var fimNoDia = (
            sessao.HoraInicioPlanejada.Ticks +
            TimeSpan.FromMinutes(sessao.DuracaoPlanejadaMinutos).Ticks +
            TicksPorMinuto - 1) / TicksPorMinuto;

        var inicioAbsoluto = diaInicialAbsoluto + inicioNoDia;
        var fimAbsoluto = diaInicialAbsoluto + fimNoDia;

        var inicioDoDiaConsultado =
            (long)data.DayNumber * MinutosPorDia;

        var inicio = Math.Max(
            inicioAbsoluto,
            inicioDoDiaConsultado);

        var fim = Math.Min(
            fimAbsoluto,
            inicioDoDiaConsultado + MinutosPorDia);

        if (inicio >= fim)
        {
            return null;
        }

        return new Intervalo(
            (int)(inicio - inicioDoDiaConsultado),
            (int)(fim - inicioDoDiaConsultado));
    }

    private static List<Intervalo> SubtrairIntervalo(
        IEnumerable<Intervalo> disponiveis,
        Intervalo ocupado)
    {
        var resultado = new List<Intervalo>();

        foreach (var disponivel in disponiveis)
        {
            if (ocupado.FimMinuto <= disponivel.InicioMinuto ||
                ocupado.InicioMinuto >= disponivel.FimMinuto)
            {
                resultado.Add(disponivel);
                continue;
            }

            if (ocupado.InicioMinuto > disponivel.InicioMinuto)
            {
                resultado.Add(new Intervalo(
                    disponivel.InicioMinuto,
                    Math.Min(
                        ocupado.InicioMinuto,
                        disponivel.FimMinuto)));
            }

            if (ocupado.FimMinuto < disponivel.FimMinuto)
            {
                resultado.Add(new Intervalo(
                    Math.Max(
                        ocupado.FimMinuto,
                        disponivel.InicioMinuto),
                    disponivel.FimMinuto));
            }
        }

        return resultado
            .OrderBy(item => item.InicioMinuto)
            .ToList();
    }

    private static (DateOnly Data, int Indice, Intervalo Intervalo)?
        EncontrarPrimeiroIntervalo(
            IReadOnlyCollection<DateOnly> datasSemana,
            IReadOnlyDictionary<DateOnly, List<Intervalo>> intervalosLivres,
            int duracao)
    {
        foreach (var data in datasSemana)
        {
            var intervalos = intervalosLivres[data];

            for (var indice = 0; indice < intervalos.Count; indice++)
            {
                var intervalo = intervalos[indice];

                if (intervalo.FimMinuto - intervalo.InicioMinuto >= duracao)
                {
                    return (data, indice, intervalo);
                }
            }
        }

        return null;
    }

    private static void ConsumirIntervalo(
        List<Intervalo> intervalos,
        int indice,
        Intervalo utilizado,
        int fimMinuto)
    {
        if (fimMinuto >= utilizado.FimMinuto)
        {
            intervalos.RemoveAt(indice);
            return;
        }

        intervalos[indice] = new Intervalo(
            fimMinuto,
            utilizado.FimMinuto);
    }

    private static MotivoNaoAlocacao DeterminarMotivo(
        int duracao,
        IReadOnlyDictionary<DateOnly, List<Intervalo>> intervalosDisponiveis,
        IReadOnlyDictionary<DateOnly, List<Intervalo>> intervalosAposSessoes)
    {
        if (!PossuiIntervaloSuficiente(
                intervalosDisponiveis,
                duracao))
        {
            if (!intervalosDisponiveis.Values.Any(lista => lista.Count > 0))
            {
                return MotivoNaoAlocacao.SemDisponibilidadeNaSemana;
            }

            return MotivoNaoAlocacao.DuracaoMaiorQueQualquerDisponibilidade;
        }

        if (!PossuiIntervaloSuficiente(
                intervalosAposSessoes,
                duracao))
        {
            return MotivoNaoAlocacao.HorarioOcupadoPorSessaoExistente;
        }

        return MotivoNaoAlocacao.CapacidadeConsumidaPorAtividadesPrioritarias;
    }

    private static bool PossuiIntervaloSuficiente(
        IReadOnlyDictionary<DateOnly, List<Intervalo>> intervalos,
        int duracao)
    {
        return intervalos.Values
            .SelectMany(lista => lista)
            .Any(item =>
                item.FimMinuto - item.InicioMinuto >= duracao);
    }

    private static AtividadeNaoAlocadaResponse CriarNaoAlocada(
        Atividade atividade,
        MotivoNaoAlocacao motivo)
    {
        var descricao = motivo switch
        {
            MotivoNaoAlocacao.EstimativaAusente =>
                "A atividade não possui estimativa de duração.",

            MotivoNaoAlocacao.EstimativaInvalida =>
                "A estimativa de duração deve ser maior que zero.",

            MotivoNaoAlocacao.SemDisponibilidadeNaSemana =>
                "Não há intervalo de disponibilidade utilizável nesta semana.",

            MotivoNaoAlocacao.DuracaoMaiorQueQualquerDisponibilidade =>
                "A atividade é maior que todos os intervalos disponíveis.",

            MotivoNaoAlocacao.HorarioOcupadoPorSessaoExistente =>
                "As sessões existentes ocupam os intervalos que comportariam a atividade.",

            MotivoNaoAlocacao.CapacidadeConsumidaPorAtividadesPrioritarias =>
                "Os intervalos compatíveis foram usados por atividades de prioridade maior.",

            _ => throw new ArgumentOutOfRangeException(nameof(motivo))
        };

        return new AtividadeNaoAlocadaResponse(
            atividade.DemandaAcademicaId,
            atividade.TarefaDemandaId,
            atividade.Titulo,
            motivo,
            descricao);
    }

    private static DemandaAcademicaResponse ParaResposta(
        DemandaAcademica demanda)
    {
        return new DemandaAcademicaResponse(
            demanda.Id,
            demanda.Titulo,
            demanda.Descricao,
            demanda.Tipo,
            demanda.Prazo,
            demanda.Importancia,
            demanda.EsforcoEstimadoMinutos,
            demanda.Situacao,
            demanda.CriadoEm);
    }

    private static int ArredondarMinutoInicial(TimeOnly horario)
    {
        return (int)Math.Ceiling(
            horario.Ticks / (double)TicksPorMinuto);
    }

    private static int ArredondarMinutoFinal(TimeOnly horario)
    {
        return (int)(horario.Ticks / TicksPorMinuto);
    }

    private sealed record Atividade(
        int? DemandaAcademicaId,
        int? TarefaDemandaId,
        string Titulo,
        int? DuracaoMinutos);

    private sealed record Intervalo(
        int InicioMinuto,
        int FimMinuto);
}