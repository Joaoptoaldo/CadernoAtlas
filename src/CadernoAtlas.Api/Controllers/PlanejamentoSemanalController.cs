using CadernoAtlas.Api.Contracts.PlanejamentoSemanal;
using CadernoAtlas.Api.Contracts.SessoesEstudo;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using CadernoAtlas.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Data;

namespace CadernoAtlas.Api.Controllers;

/// <summary>
/// Controlador para o planejamento semanal de estudos.
/// Gerencia a obtenção de uma prévia do planejamento semanal com base nas demandas acadêmicas, disponibilidades de estudo e sessões de estudo ativas.
/// </summary>
[ApiController]
[Route("api/planejamento-semanal")]
public sealed class PlanejamentoSemanalController : ControllerBase
{
    private readonly PlanejamentoSemanalPropostaIdService _propostaIdService;
    private readonly AppDbContext _dbContext;
    private readonly PlanejadorSemanal _planejador;
    private readonly TimeProvider _timeProvider;
    private readonly TimeZoneInfo _fusoHorario;

    public PlanejamentoSemanalController(
        AppDbContext dbContext,
        PlanejadorSemanal planejador,
        PlanejamentoSemanalPropostaIdService propostaIdService,
        TimeProvider timeProvider,
        TimeZoneInfo fusoHorario)
    {
        _dbContext = dbContext;
        _planejador = planejador;
        _timeProvider = timeProvider;
        _propostaIdService = propostaIdService;
        _fusoHorario = fusoHorario;
    }

    [HttpGet("previa")]
    public async Task<ActionResult<PlanejamentoSemanalResponse>> ObterPrevia(
        [FromQuery] PreviaPlanejamentoSemanalRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryObterInicioSemana(
                request.InicioSemana,
                out var inicioSemana,
                out var erro))
        {
            return BadRequest(erro);
        }

        var fimSemana = inicioSemana.AddDays(6);
        var agora = _timeProvider.GetUtcNow();

        var demandas = await _dbContext.DemandasAcademicas
            .AsNoTracking()
            .Where(demanda =>
                demanda.Situacao == SituacaoDemandaAcademica.Pendente ||
                demanda.Situacao == SituacaoDemandaAcademica.EmAndamento)
            .Include(demanda => demanda.Tarefas)
            .ToListAsync(cancellationToken);

        var disponibilidades = await _dbContext.DisponibilidadesEstudo
            .AsNoTracking()
            .Where(disponibilidade =>
                disponibilidade.Data >= inicioSemana &&
                disponibilidade.Data <= fimSemana)
            .ToListAsync(cancellationToken);

        // Sessões ativas também suprimem a atividade vinculada quando sua data
        // está fora da semana; sessões antigas podem ainda cruzar a fronteira.
        var sessoesAtivas = await _dbContext.SessoesEstudo
            .AsNoTracking()
            .Where(sessao =>
                sessao.Situacao == SituacaoSessaoEstudo.Planejada ||
                sessao.Situacao == SituacaoSessaoEstudo.EmAndamento)
            .ToListAsync(cancellationToken);

        var planejamento = _planejador.Planejar(
            new PlanejarSemanaRequest(inicioSemana, agora),
            demandas,
            disponibilidades,
            sessoesAtivas);

        var fingerprintDados =
            PlanejamentoSemanalDadosFingerprintService.Calcular(
                demandas,
                disponibilidades,
                sessoesAtivas);

        var propostaId = _propostaIdService.GerarPropostaId(
            planejamento.InicioSemana,
            planejamento.Agora,
            fingerprintDados,
            planejamento.Alocacoes);

        return Ok(planejamento with
        {
            PropostaId = propostaId
        });
    }

    [HttpPost("confirmar")]
    public async Task<ActionResult<ConfirmarPlanejamentoSemanalResponse>> Confirmar(
        ConfirmarPlanejamentoSemanalRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryObterInicioSemana(
                request.InicioSemana,
                out var inicioSemana,
                out var erro))
        {
            return BadRequest(erro);
        }

        if (request.Agora is not DateTimeOffset agoraRecebido ||
            request.Alocacoes is null)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Proposta incompleta.",
                Detail = "Informe o instante original e as alocações da prévia.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        if (request.Alocacoes.Any(alocacao => alocacao is null))
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Alocação inválida.",
                Detail = "A lista de alocações não pode conter itens nulos.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        var agoraOriginal = agoraRecebido.ToUniversalTime();
        var agoraAtual = _timeProvider.GetUtcNow();
        var fimSemana = inicioSemana.AddDays(6);

        await using var transacao =
            await _dbContext.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);

        try
        {
            var demandas = await _dbContext.DemandasAcademicas
                .AsNoTracking()
                .Where(demanda =>
                    demanda.Situacao == SituacaoDemandaAcademica.Pendente ||
                    demanda.Situacao == SituacaoDemandaAcademica.EmAndamento)
                .Include(demanda => demanda.Tarefas)
                .ToListAsync(cancellationToken);

            var disponibilidades = await _dbContext.DisponibilidadesEstudo
                .AsNoTracking()
                .Where(disponibilidade =>
                    disponibilidade.Data >= inicioSemana &&
                    disponibilidade.Data <= fimSemana)
                .ToListAsync(cancellationToken);

            var sessoesAtivas = await _dbContext.SessoesEstudo
                .AsNoTracking()
                .Where(sessao =>
                    sessao.Situacao == SituacaoSessaoEstudo.Planejada ||
                    sessao.Situacao == SituacaoSessaoEstudo.EmAndamento)
                .ToListAsync(cancellationToken);

            var fingerprintDados =
                PlanejamentoSemanalDadosFingerprintService.Calcular(
                    demandas,
                    disponibilidades,
                    sessoesAtivas);

            var planejamento = _planejador.Planejar(
                new PlanejarSemanaRequest(inicioSemana, agoraOriginal),
                demandas,
                disponibilidades,
                sessoesAtivas);

            if (!_propostaIdService.ValidarPropostaId(
                    request.PropostaId,
                    inicioSemana,
                    agoraOriginal,
                    fingerprintDados,
                    request.Alocacoes) ||
                !planejamento.Alocacoes.SequenceEqual(request.Alocacoes) ||
                !AlocacoesContinuamNoFuturo(
                    planejamento.Alocacoes,
                    agoraAtual))
            {
                await transacao.RollbackAsync(CancellationToken.None);
                return Conflict(ObterProblemaDeProposta());
            }

            var sessoes = planejamento.Alocacoes
                .Select(alocacao => new SessaoEstudo
                {
                    Titulo = alocacao.Titulo,
                    DataPlanejada = alocacao.DataPlanejada,
                    HoraInicioPlanejada = alocacao.HoraInicio,
                    DuracaoPlanejadaMinutos =
                        alocacao.DuracaoPlanejadaMinutos,
                    Situacao = SituacaoSessaoEstudo.Planejada,
                    DemandaAcademicaId = alocacao.DemandaAcademicaId,
                    TarefaDemandaId = alocacao.TarefaDemandaId,
                    CriadoEm = agoraAtual.UtcDateTime
                })
                .ToList();

            _dbContext.SessoesEstudo.AddRange(sessoes);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transacao.CommitAsync(cancellationToken);

            return Ok(new ConfirmarPlanejamentoSemanalResponse(
                inicioSemana,
                agoraOriginal,
                sessoes.Select(ParaResposta).ToList()));
        }
        catch (DbUpdateException excecao)
            when (EhViolacaoDeSobreposicao(excecao))
        {
            await transacao.RollbackAsync(CancellationToken.None);
            return Conflict(ObterProblemaDeSobreposicao());
        }
        catch (Exception excecao)
            when (EhFalhaDeSerializacao(excecao))
        {
            await transacao.RollbackAsync(CancellationToken.None);
            return Conflict(ObterProblemaDeSerializacao());
        }
    }

    private static bool TryObterInicioSemana(
        DateOnly? valor,
        out DateOnly inicioSemana,
        out ProblemDetails erro)
    {
        if (valor is not DateOnly inicio)
        {
            inicioSemana = default;
            erro = new ProblemDetails
            {
                Title = "Início de semana obrigatório.",
                Detail = "Informe InicioSemana no formato yyyy-MM-dd.",
                Status = StatusCodes.Status400BadRequest
            };
            return false;
        }

        if (inicio.DayOfWeek != DayOfWeek.Monday)
        {
            inicioSemana = default;
            erro = new ProblemDetails
            {
                Title = "Início de semana inválido.",
                Detail = "InicioSemana deve ser uma segunda-feira.",
                Status = StatusCodes.Status400BadRequest
            };
            return false;
        }

        if (inicio > DateOnly.MaxValue.AddDays(-6))
        {
            inicioSemana = default;
            erro = new ProblemDetails
            {
                Title = "Semana inválida.",
                Detail = "A semana informada ultrapassa o último dia representável.",
                Status = StatusCodes.Status400BadRequest
            };
            return false;
        }

        inicioSemana = inicio;
        erro = new ProblemDetails();
        return true;
    }

    private bool AlocacoesContinuamNoFuturo(
        IReadOnlyCollection<AlocacaoPlanejamentoResponse> alocacoes,
        DateTimeOffset agora)
    {
        var agoraLocal = TimeZoneInfo.ConvertTime(
            agora,
            _fusoHorario);

        var instanteAtualLocal = agoraLocal.DateTime;

        return alocacoes.All(alocacao =>
        {
            var inicioPlanejadoLocal = alocacao.DataPlanejada.ToDateTime(
                alocacao.HoraInicio,
                DateTimeKind.Unspecified);

            return inicioPlanejadoLocal > instanteAtualLocal;
        });
    }

    private static ProblemDetails ObterProblemaDeProposta()
    {
        return new ProblemDetails
        {
            Title = "Proposta desatualizada.",
            Detail = "A prévia não corresponde mais aos dados atuais ou contém alocações inválidas.",
            Status = StatusCodes.Status409Conflict
        };
    }

    private static ProblemDetails ObterProblemaDeSerializacao()
    {
        return new ProblemDetails
        {
            Title = "Conflito ao confirmar planejamento.",
            Detail = "Os dados foram alterados simultaneamente. Gere uma nova prévia.",
            Status = StatusCodes.Status409Conflict
        };
    }

    private static bool EhFalhaDeSerializacao(Exception excecao)
    {
        for (Exception? atual = excecao;
            atual is not null;
            atual = atual.InnerException)
        {
            if (atual is PostgresException postgresException
                && postgresException.SqlState == "40001")
            {
                return true;
            }
        }

        return false;
    }

    private static bool EhViolacaoDeSobreposicao(Exception excecao)
    {
        for (Exception? atual = excecao;
            atual is not null;
            atual = atual.InnerException)
        {
            if (atual is PostgresException postgresException
                && postgresException.SqlState == "23P01"
                && postgresException.ConstraintName
                    == "EX_SessoesEstudo_SemSobreposicaoAtiva")
            {
                return true;
            }
        }

        return false;
    }

    private static ProblemDetails ObterProblemaDeSobreposicao()
    {
        return new ProblemDetails
        {
            Title = "Sessão sobreposta.",
            Detail = "Já existe uma sessão de estudo ativa que se sobrepõe ao intervalo informado.",
            Status = StatusCodes.Status409Conflict
        };
    }

    private static SessaoEstudoResponse ParaResposta(SessaoEstudo sessao)
    {
        return new SessaoEstudoResponse(
            sessao.Id,
            sessao.Titulo,
            sessao.DataPlanejada,
            sessao.HoraInicioPlanejada,
            sessao.DuracaoPlanejadaMinutos,
            sessao.DuracaoRealMinutos,
            sessao.Situacao,
            sessao.DemandaAcademicaId,
            sessao.TarefaDemandaId,
            sessao.Observacoes,
            sessao.CriadoEm,
            sessao.InicioRealEm,
            sessao.ConcluidaEm,
            sessao.CanceladaEm);
    }
}
