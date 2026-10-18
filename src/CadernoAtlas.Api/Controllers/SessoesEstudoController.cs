using CadernoAtlas.Api.Contracts.SessoesEstudo;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CadernoAtlas.Api.Controllers;

/// <summary>
/// Controller para gerenciar sessões de estudo.
/// Fornece endpoints para criar, atualizar, iniciar, concluir, cancelar e excluir sessões de estudo, bem como para listar e obter detalhes de sessões específicas.
/// </summary>
[ApiController]
[Route("api/sessoes-estudo")]
public sealed class SessoesEstudoController : ControllerBase
{
    private readonly AppDbContext _context;

    public SessoesEstudoController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SessaoEstudoResponse>>> Listar(
        [FromQuery] DateOnly? dataDe,
        [FromQuery] DateOnly? dataAte,
        [FromQuery] SituacaoSessaoEstudo? situacao,
        CancellationToken cancellationToken)
    {
        var consulta = _context.SessoesEstudo
            .AsNoTracking();

        if (dataDe.HasValue)
        {
            consulta = consulta.Where(
                sessao => sessao.DataPlanejada >= dataDe.Value);
        }

        if (dataAte.HasValue)
        {
            consulta = consulta.Where(
                sessao => sessao.DataPlanejada <= dataAte.Value);
        }

        if (situacao.HasValue)
        {
            consulta = consulta.Where(
                sessao => sessao.Situacao == situacao.Value);
        }

        var sessoes = await consulta
            .OrderBy(sessao => sessao.DataPlanejada)
            .ThenBy(sessao => sessao.HoraInicioPlanejada)
            .ThenBy(sessao => sessao.Id)
            .ToListAsync(cancellationToken);

        return Ok(sessoes.Select(ParaResposta).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<SessaoEstudoResponse>> ObterPorId(
        int id,
        CancellationToken cancellationToken)
    {
        var sessao = await _context.SessoesEstudo
            .AsNoTracking()
            .FirstOrDefaultAsync(sessao => sessao.Id == id, cancellationToken);

        if (sessao is null)
            return NotFound();

        return Ok(ParaResposta(sessao));
    }

    [HttpPost]
    public async Task<ActionResult<SessaoEstudoResponse>> Criar(
        CriarSessaoEstudoRequest request,
        CancellationToken cancellationToken)
    {
        if (!await ValidarVinculosAsync(
                request.DemandaAcademicaId,
                request.TarefaDemandaId,
                cancellationToken))
        {
            return ValidationProblem(ModelState);
        }

        var sessao = new SessaoEstudo
        {
            Titulo = request.Titulo.Trim(),
            DataPlanejada = request.DataPlanejada!.Value,
            HoraInicioPlanejada = request.HoraInicioPlanejada!.Value,
            DuracaoPlanejadaMinutos = request.DuracaoPlanejadaMinutos,
            DemandaAcademicaId = request.DemandaAcademicaId,
            TarefaDemandaId = request.TarefaDemandaId,
            Observacoes = NormalizarOpcional(request.Observacoes)
        };

        _context.SessoesEstudo.Add(sessao);

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException excecao)
            when (EhViolacaoDeSobreposicao(excecao))
        {
            return Conflict(ObterProblemaDeSobreposicao());
        }

        return CreatedAtAction(
            nameof(ObterPorId),
            new { id = sessao.Id },
            ParaResposta(sessao));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<SessaoEstudoResponse>> Atualizar(
        int id,
        AtualizarSessaoEstudoRequest request,
        CancellationToken cancellationToken)
    {
        var sessao = await _context.SessoesEstudo
            .FirstOrDefaultAsync(sessao => sessao.Id == id, cancellationToken);

        if (sessao is null)
            return NotFound();

        if (sessao.Situacao != SituacaoSessaoEstudo.Planejada)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Sessão não pode ser editada",
                Detail = "Somente sessões planejadas podem ser editadas."
            });
        }

        if (!await ValidarVinculosAsync(
                request.DemandaAcademicaId,
                request.TarefaDemandaId,
                cancellationToken))
        {
            return ValidationProblem(ModelState);
        }

        sessao.Titulo = request.Titulo.Trim();
        sessao.DataPlanejada = request.DataPlanejada!.Value;
        sessao.HoraInicioPlanejada = request.HoraInicioPlanejada!.Value;
        sessao.DuracaoPlanejadaMinutos = request.DuracaoPlanejadaMinutos;
        sessao.DemandaAcademicaId = request.DemandaAcademicaId;
        sessao.TarefaDemandaId = request.TarefaDemandaId;
        sessao.Observacoes = NormalizarOpcional(request.Observacoes);

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException excecao)
            when (EhViolacaoDeSobreposicao(excecao))
        {
            return Conflict(ObterProblemaDeSobreposicao());
        }

        return Ok(ParaResposta(sessao));
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

    [HttpPost("{id:int}/iniciar")]
    public async Task<ActionResult<SessaoEstudoResponse>> Iniciar(
        int id,
        CancellationToken cancellationToken)
    {
        var sessao = await _context.SessoesEstudo
            .FirstOrDefaultAsync(sessao => sessao.Id == id, cancellationToken);

        if (sessao is null)
            return NotFound();

        if (sessao.Situacao != SituacaoSessaoEstudo.Planejada)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Não é possível iniciar a sessão",
                Detail = "Somente sessões planejadas podem ser iniciadas."
            });
        }

        sessao.Situacao = SituacaoSessaoEstudo.EmAndamento;
        sessao.InicioRealEm = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(ParaResposta(sessao));
    }

    [HttpPost("{id:int}/concluir")]
    public async Task<ActionResult<SessaoEstudoResponse>> Concluir(
        int id,
        CancellationToken cancellationToken)
    {
        var sessao = await _context.SessoesEstudo
            .FirstOrDefaultAsync(sessao => sessao.Id == id, cancellationToken);

        if (sessao is null)
            return NotFound();

        if (sessao.Situacao != SituacaoSessaoEstudo.EmAndamento
            || sessao.InicioRealEm is null)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Não é possível concluir a sessão",
                Detail = "A sessão precisa estar em andamento para ser concluída."
            });
        }

        var agora = DateTime.UtcNow;

        sessao.Situacao = SituacaoSessaoEstudo.Concluida;
        sessao.ConcluidaEm = agora;
        sessao.DuracaoRealMinutos = CalcularDuracaoRealMinutos(
            sessao.InicioRealEm.Value,
            agora);

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(ParaResposta(sessao));
    }

    [HttpPost("{id:int}/cancelar")]
    public async Task<ActionResult<SessaoEstudoResponse>> Cancelar(
        int id,
        CancellationToken cancellationToken)
    {
        var sessao = await _context.SessoesEstudo
            .FirstOrDefaultAsync(sessao => sessao.Id == id, cancellationToken);

        if (sessao is null)
            return NotFound();

        if (sessao.Situacao != SituacaoSessaoEstudo.Planejada
            && sessao.Situacao != SituacaoSessaoEstudo.EmAndamento)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Não é possível cancelar a sessão",
                Detail = "Somente sessões planejadas ou em andamento podem ser canceladas."
            });
        }

        var agora = DateTime.UtcNow;

        if (sessao.Situacao == SituacaoSessaoEstudo.EmAndamento
            && sessao.InicioRealEm is DateTime inicio)
        {
            sessao.DuracaoRealMinutos = CalcularDuracaoRealMinutos(inicio, agora);
        }

        sessao.Situacao = SituacaoSessaoEstudo.Cancelada;
        sessao.CanceladaEm = agora;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(ParaResposta(sessao));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Excluir(
        int id,
        CancellationToken cancellationToken)
    {
        var sessao = await _context.SessoesEstudo
            .FirstOrDefaultAsync(sessao => sessao.Id == id, cancellationToken);

        if (sessao is null)
            return NotFound();

        if (sessao.Situacao != SituacaoSessaoEstudo.Planejada)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Não é possível excluir a sessão",
                Detail = "Somente sessões planejadas podem ser excluídas. Registros de sessões iniciadas devem ser preservados."
            });
        }

        _context.SessoesEstudo.Remove(sessao);

        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private async Task<bool> ValidarVinculosAsync(
        int? demandaAcademicaId,
        int? tarefaDemandaId,
        CancellationToken cancellationToken)
    {
        if (demandaAcademicaId.HasValue
            && tarefaDemandaId.HasValue)
        {
            ModelState.AddModelError(
                nameof(CriarSessaoEstudoRequest.DemandaAcademicaId),
                "Vincule a sessão a uma demanda ou a uma tarefa, não a ambas.");

            return false;
        }

        if (demandaAcademicaId is int demandaId
            && !await _context.DemandasAcademicas.AnyAsync(
                demanda => demanda.Id == demandaId,
                cancellationToken))
        {
            ModelState.AddModelError(
                nameof(CriarSessaoEstudoRequest.DemandaAcademicaId),
                "A demanda acadêmica informada não existe.");

            return false;
        }

        if (tarefaDemandaId is int tarefaId
            && !await _context.TarefasDemanda.AnyAsync(
                tarefa => tarefa.Id == tarefaId,
                cancellationToken))
        {
            ModelState.AddModelError(
                nameof(CriarSessaoEstudoRequest.TarefaDemandaId),
                "A tarefa informada não existe.");

            return false;
        }

        return true;
    }

    private static int CalcularDuracaoRealMinutos(
        DateTime inicio,
        DateTime fim)
    {
        var minutos = (fim - inicio).TotalMinutes;

        return Math.Max(0, (int)Math.Floor(minutos));
    }

    private static string? NormalizarOpcional(string? valor)
    {
        return string.IsNullOrWhiteSpace(valor)
            ? null
            : valor.Trim();
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