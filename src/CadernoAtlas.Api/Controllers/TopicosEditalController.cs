using CadernoAtlas.Api.Contracts.TopicosEdital;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CadernoAtlas.Api.Controllers;

/// <summary>
/// Controller responsável por gerenciar os tópicos de uma disciplina de um edital de concurso, permitindo operações de listagem, criação, atualização e exclusão.
/// </summary>
[ApiController]
[Route(
    "api/concursos/{concursoId:int}/disciplinas/{disciplinaId:int}/topicos")]
public sealed class TopicosEditalController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public TopicosEditalController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TopicoEditalResponse>>>
        Listar(
            int concursoId,
            int disciplinaId,
            CancellationToken cancellationToken)
    {
        var disciplinaExiste = await DisciplinaPertenceAoConcursoAsync(
            concursoId,
            disciplinaId,
            cancellationToken);

        if (!disciplinaExiste)
        {
            return NotFound();
        }

        var topicos = await _dbContext.TopicosEdital
            .AsNoTracking()
            .Where(topico =>
                topico.DisciplinaEditalId == disciplinaId)
            .OrderBy(topico => topico.TopicoPaiId)
            .ThenBy(topico => topico.Ordem)
            .ThenBy(topico => topico.Descricao)
            .Select(topico => new TopicoEditalResponse(
                topico.Id,
                topico.DisciplinaEditalId,
                topico.TopicoPaiId,
                topico.Descricao,
                topico.Ordem,
                topico.Status.ToString()))
            .ToListAsync(cancellationToken);

        return Ok(topicos);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TopicoEditalResponse>> ObterPorId(
        int concursoId,
        int disciplinaId,
        int id,
        CancellationToken cancellationToken)
    {
        var topico = await _dbContext.TopicosEdital
            .AsNoTracking()
            .Where(topico =>
                topico.Id == id &&
                topico.DisciplinaEditalId == disciplinaId &&
                topico.DisciplinaEdital.ConcursoId == concursoId)
            .Select(topico => new TopicoEditalResponse(
                topico.Id,
                topico.DisciplinaEditalId,
                topico.TopicoPaiId,
                topico.Descricao,
                topico.Ordem,
                topico.Status.ToString()))
            .FirstOrDefaultAsync(cancellationToken);

        if (topico is null)
        {
            return NotFound();
        }

        return Ok(topico);
    }

    [HttpPost]
    public async Task<ActionResult<TopicoEditalResponse>> Criar(
        int concursoId,
        int disciplinaId,
        [FromBody] CriarTopicoEditalRequest request,
        CancellationToken cancellationToken)
    {
        var disciplinaExiste = await DisciplinaPertenceAoConcursoAsync(
            concursoId,
            disciplinaId,
            cancellationToken);

        if (!disciplinaExiste)
        {
            return NotFound();
        }

        var paiValido = await TopicoPaiValidoAsync(
            disciplinaId,
            request.TopicoPaiId,
            null,
            cancellationToken);

        if (!paiValido)
        {
            return BadRequest(
                "O tópico pai deve pertencer à mesma disciplina e não pode formar um ciclo.");
        }

        var topico = new TopicoEdital
        {
            DisciplinaEditalId = disciplinaId,
            TopicoPaiId = request.TopicoPaiId,
            Descricao = request.Descricao.Trim(),
            Ordem = request.Ordem,
            Status = request.Status
        };

        _dbContext.TopicosEdital.Add(topico);

        await _dbContext.SaveChangesAsync(cancellationToken);

        var resposta = MapearResposta(topico);

        return CreatedAtAction(
            nameof(ObterPorId),
            new { concursoId, disciplinaId, id = topico.Id },
            resposta);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<TopicoEditalResponse>> Atualizar(
        int concursoId,
        int disciplinaId,
        int id,
        [FromBody] AtualizarTopicoEditalRequest request,
        CancellationToken cancellationToken)
    {
        var topico = await _dbContext.TopicosEdital
            .FirstOrDefaultAsync(
                topico =>
                    topico.Id == id &&
                    topico.DisciplinaEditalId == disciplinaId &&
                    topico.DisciplinaEdital.ConcursoId == concursoId,
                cancellationToken);

        if (topico is null)
        {
            return NotFound();
        }

        var paiValido = await TopicoPaiValidoAsync(
            disciplinaId,
            request.TopicoPaiId,
            topico.Id,
            cancellationToken);

        if (!paiValido)
        {
            return BadRequest(
                "O tópico pai deve pertencer à mesma disciplina e não pode formar um ciclo.");
        }

        topico.Descricao = request.Descricao.Trim();
        topico.Ordem = request.Ordem;
        topico.TopicoPaiId = request.TopicoPaiId;
        topico.Status = request.Status;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapearResposta(topico));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Excluir(
        int concursoId,
        int disciplinaId,
        int id,
        CancellationToken cancellationToken)
    {
        var topico = await _dbContext.TopicosEdital
            .FirstOrDefaultAsync(
                topico =>
                    topico.Id == id &&
                    topico.DisciplinaEditalId == disciplinaId &&
                    topico.DisciplinaEdital.ConcursoId == concursoId,
                cancellationToken);

        if (topico is null)
        {
            return NotFound();
        }

        _dbContext.TopicosEdital.Remove(topico);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private async Task<bool> DisciplinaPertenceAoConcursoAsync(
        int concursoId,
        int disciplinaId,
        CancellationToken cancellationToken)
    {
        return await _dbContext.DisciplinasEdital
            .AnyAsync(
                disciplina =>
                    disciplina.Id == disciplinaId &&
                    disciplina.ConcursoId == concursoId,
                cancellationToken);
    }

    private async Task<bool> TopicoPaiValidoAsync(
        int disciplinaId,
        int? topicoPaiId,
        int? topicoAtualId,
        CancellationToken cancellationToken)
    {
        if (topicoPaiId is null)
        {
            return true;
        }

        var visitados = new HashSet<int>();
        int? idAtual = topicoPaiId;

        while (idAtual.HasValue)
        {
            var idAncestral = idAtual.Value;

            if (idAncestral == topicoAtualId ||
                !visitados.Add(idAncestral))
            {
                return false;
            }

            var ancestral = await _dbContext.TopicosEdital
                .AsNoTracking()
                .Where(topico => topico.Id == idAncestral)
                .Select(topico => new
                {
                    topico.Id,
                    topico.DisciplinaEditalId,
                    topico.TopicoPaiId
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (ancestral is null ||
                ancestral.DisciplinaEditalId != disciplinaId)
            {
                return false;
            }

            idAtual = ancestral.TopicoPaiId;
        }

        return true;
    }

    private static TopicoEditalResponse MapearResposta(
        TopicoEdital topico)
    {
        return new TopicoEditalResponse(
            topico.Id,
            topico.DisciplinaEditalId,
            topico.TopicoPaiId,
            topico.Descricao,
            topico.Ordem,
            topico.Status.ToString());
    }
}