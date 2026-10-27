using CadernoAtlas.Api.Contracts.TarefasDemanda;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CadernoAtlas.Api.Controllers;

/// <summary>
/// Controller responsável por gerenciar as tarefas de uma demanda acadêmica.
/// </summary>
[ApiController]
[Route("api/demandas-academicas/{demandaId:int}/tarefas")]
public sealed class TarefasDemandaController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public TarefasDemandaController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TarefaDemandaResponse>>> Listar(
        int demandaId,
        CancellationToken cancellationToken)
    {
        var demandaExiste = await _dbContext.DemandasAcademicas
            .AnyAsync(
                demanda => demanda.Id == demandaId,
                cancellationToken);

        if (!demandaExiste)
        {
            return NotFound();
        }

        var tarefas = await _dbContext.TarefasDemanda
            .AsNoTracking()
            .Where(tarefa => tarefa.DemandaAcademicaId == demandaId)
            .OrderBy(tarefa => tarefa.Ordem)
            .ThenBy(tarefa => tarefa.Id)
            .Select(tarefa => new TarefaDemandaResponse(
                tarefa.Id,
                tarefa.DemandaAcademicaId,
                tarefa.Titulo,
                tarefa.Descricao,
                tarefa.Ordem,
                tarefa.EsforcoEstimadoMinutos,
                tarefa.Situacao))
            .ToListAsync(cancellationToken);

        return Ok(tarefas);
    }

    [HttpGet("{tarefaId:int}")]
    public async Task<ActionResult<TarefaDemandaResponse>> ObterPorId(
        int demandaId,
        int tarefaId,
        CancellationToken cancellationToken)
    {
        var tarefa = await _dbContext.TarefasDemanda
            .AsNoTracking()
            .Where(tarefa =>
                tarefa.Id == tarefaId
                && tarefa.DemandaAcademicaId == demandaId)
            .Select(tarefa => new TarefaDemandaResponse(
                tarefa.Id,
                tarefa.DemandaAcademicaId,
                tarefa.Titulo,
                tarefa.Descricao,
                tarefa.Ordem,
                tarefa.EsforcoEstimadoMinutos,
                tarefa.Situacao))
            .FirstOrDefaultAsync(cancellationToken);

        if (tarefa is null)
        {
            return NotFound();
        }

        return Ok(tarefa);
    }

    [HttpPost]
    public async Task<ActionResult<TarefaDemandaResponse>> Criar(
        int demandaId,
        [FromBody] CriarTarefaDemandaRequest request,
        CancellationToken cancellationToken)
    {
        var situacaoDemanda = await _dbContext.DemandasAcademicas
            .Where(demanda => demanda.Id == demandaId)
            .Select(demanda => (SituacaoDemandaAcademica?)demanda.Situacao)
            .FirstOrDefaultAsync(cancellationToken);

        if (situacaoDemanda is null)
        {
            return NotFound();
        }

        if (situacaoDemanda == SituacaoDemandaAcademica.Concluida
            || situacaoDemanda == SituacaoDemandaAcademica.Cancelada)
        {
            return Conflict(new ProblemDetails
            {
                Title = "A demanda não permite alterações.",
                Detail = "Reabra a demanda antes de adicionar novas tarefas.",
                Status = StatusCodes.Status409Conflict
            });
        }

        var ultimaOrdem = await _dbContext.TarefasDemanda
            .Where(tarefa => tarefa.DemandaAcademicaId == demandaId)
            .Select(tarefa => (int?)tarefa.Ordem)
            .MaxAsync(cancellationToken);

        var tarefa = new TarefaDemanda
        {
            DemandaAcademicaId = demandaId,
            Titulo = request.Titulo.Trim(),
            Descricao = NormalizarOpcional(request.Descricao),
            Ordem = (ultimaOrdem ?? -1) + 1,
            EsforcoEstimadoMinutos = request.EsforcoEstimadoMinutos
        };

        _dbContext.TarefasDemanda.Add(tarefa);

        await _dbContext.SaveChangesAsync(cancellationToken);

        var resposta = MapearResposta(tarefa);

        return CreatedAtAction(
            nameof(ObterPorId),
            new { demandaId, tarefaId = tarefa.Id },
            resposta);
    }

    [HttpPut("{tarefaId:int}")]
    public async Task<ActionResult<TarefaDemandaResponse>> Atualizar(
        int demandaId,
        int tarefaId,
        [FromBody] AtualizarTarefaDemandaRequest request,
        CancellationToken cancellationToken)
    {
        var tarefas = await _dbContext.TarefasDemanda
            .Where(tarefa => tarefa.DemandaAcademicaId == demandaId)
            .OrderBy(tarefa => tarefa.Ordem)
            .ThenBy(tarefa => tarefa.Id)
            .ToListAsync(cancellationToken);

        var tarefa = tarefas.FirstOrDefault(tarefa => tarefa.Id == tarefaId);
        if (tarefa is null)
        {
            return NotFound();
        }

        var situacaoDemanda = await _dbContext.DemandasAcademicas
            .Where(demanda => demanda.Id == demandaId)
            .Select(demanda => (SituacaoDemandaAcademica?)demanda.Situacao)
            .FirstOrDefaultAsync(cancellationToken);

        if (situacaoDemanda is null)
        {
            return NotFound();
        }

        if (situacaoDemanda == SituacaoDemandaAcademica.Concluida
            || situacaoDemanda == SituacaoDemandaAcademica.Cancelada)
        {
            return Conflict(new ProblemDetails
            {
                Title = "A demanda não permite alterações.",
                Detail = "Reabra a demanda antes de alterar tarefas.",
                Status = StatusCodes.Status409Conflict
            });
        }

        tarefa.Titulo = request.Titulo.Trim();
        tarefa.Descricao = NormalizarOpcional(request.Descricao);
        tarefa.Ordem = request.Ordem;
        tarefa.EsforcoEstimadoMinutos = request.EsforcoEstimadoMinutos;
        tarefa.Situacao = request.Situacao;

        // Move a tarefa para a posição solicitada e mantém a sequência contígua.
        // A API recebe Ordem baseada em zero; valores acima do tamanho viram a última posição.
        var ordemDestino = Math.Clamp(request.Ordem, 0, tarefas.Count - 1);
        tarefas.Remove(tarefa);
        tarefas.Insert(ordemDestino, tarefa);

        for (var indice = 0; indice < tarefas.Count; indice++)
        {
            tarefas[indice].Ordem = indice;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapearResposta(tarefa));
    }

    [HttpDelete("{tarefaId:int}")]
    public async Task<IActionResult> Excluir(
        int demandaId,
        int tarefaId,
        CancellationToken cancellationToken)
    {
        var tarefa = await _dbContext.TarefasDemanda
            .FirstOrDefaultAsync(
                tarefa =>
                    tarefa.Id == tarefaId
                    && tarefa.DemandaAcademicaId == demandaId,
                cancellationToken);

        if (tarefa is null)
        {
            return NotFound();
        }

        var situacaoDemanda = await _dbContext.DemandasAcademicas
            .Where(demanda => demanda.Id == demandaId)
            .Select(demanda => (SituacaoDemandaAcademica?)demanda.Situacao)
            .FirstOrDefaultAsync(cancellationToken);

        if (situacaoDemanda is null)
        {
            return NotFound();
        }

        if (situacaoDemanda == SituacaoDemandaAcademica.Concluida
            || situacaoDemanda == SituacaoDemandaAcademica.Cancelada)
        {
            return Conflict(new ProblemDetails
            {
                Title = "A demanda não permite alterações.",
                Detail = "Reabra a demanda antes de excluir tarefas.",
                Status = StatusCodes.Status409Conflict
            });
        }

        await using var transacao = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        var tarefasRestantes = await _dbContext.TarefasDemanda
            .Where(t => t.DemandaAcademicaId == demandaId && t.Id != tarefaId)
            .OrderBy(t => t.Ordem)
            .ThenBy(t => t.Id)
            .ToListAsync(cancellationToken);

        _dbContext.TarefasDemanda.Remove(tarefa);

        for (var indice = 0; indice < tarefasRestantes.Count; indice++)
        {
            tarefasRestantes[indice].Ordem = indice;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transacao.CommitAsync(cancellationToken);

        return NoContent();
    }

    private static TarefaDemandaResponse MapearResposta(
        TarefaDemanda tarefa)
    {
        return new TarefaDemandaResponse(
            tarefa.Id,
            tarefa.DemandaAcademicaId,
            tarefa.Titulo,
            tarefa.Descricao,
            tarefa.Ordem,
            tarefa.EsforcoEstimadoMinutos,
            tarefa.Situacao);
    }

    private static string? NormalizarOpcional(string? valor)
    {
        return string.IsNullOrWhiteSpace(valor)
            ? null
            : valor.Trim();
    }
}