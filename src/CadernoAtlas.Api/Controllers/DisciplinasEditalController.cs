using CadernoAtlas.Api.Contracts.DisciplinasEdital;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CadernoAtlas.Api.Controllers;

/// <summary>
/// Controller responsável por gerenciar as disciplinas de um edital de concurso, permitindo operações de listagem, criação, atualização e exclusão.
/// </summary>
[ApiController]
[Route("api/concursos/{concursoId:int}/disciplinas")]
public sealed class DisciplinasEditalController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public DisciplinasEditalController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DisciplinaEditalResponse>>>
        Listar(
            int concursoId,
            CancellationToken cancellationToken)
    {
        var concursoExiste = await _dbContext.Concursos
            .AnyAsync(
                concurso => concurso.Id == concursoId,
                cancellationToken);

        if (!concursoExiste)
        {
            return NotFound();
        }

        var disciplinas = await _dbContext.DisciplinasEdital
            .AsNoTracking()
            .Where(disciplina => disciplina.ConcursoId == concursoId)
            .OrderBy(disciplina => disciplina.Ordem)
            .ThenBy(disciplina => disciplina.Nome)
            .Select(disciplina => new DisciplinaEditalResponse(
                disciplina.Id,
                disciplina.ConcursoId,
                disciplina.Nome,
                disciplina.Ordem))
            .ToListAsync(cancellationToken);

        return Ok(disciplinas);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DisciplinaEditalResponse>> ObterPorId(
        int concursoId,
        int id,
        CancellationToken cancellationToken)
    {
        var disciplina = await _dbContext.DisciplinasEdital
            .AsNoTracking()
            .Where(disciplina =>
                disciplina.Id == id &&
                disciplina.ConcursoId == concursoId)
            .Select(disciplina => new DisciplinaEditalResponse(
                disciplina.Id,
                disciplina.ConcursoId,
                disciplina.Nome,
                disciplina.Ordem))
            .FirstOrDefaultAsync(cancellationToken);

        if (disciplina is null)
        {
            return NotFound();
        }

        return Ok(disciplina);
    }

    [HttpPost]
    public async Task<ActionResult<DisciplinaEditalResponse>> Criar(
        int concursoId,
        [FromBody] CriarDisciplinaEditalRequest request,
        CancellationToken cancellationToken)
    {
        var concursoExiste = await _dbContext.Concursos
            .AnyAsync(
                concurso => concurso.Id == concursoId,
                cancellationToken);

        if (!concursoExiste)
        {
            return NotFound();
        }

        var disciplina = new DisciplinaEdital
        {
            ConcursoId = concursoId,
            Nome = request.Nome.Trim(),
            Ordem = request.Ordem
        };

        _dbContext.DisciplinasEdital.Add(disciplina);

        await _dbContext.SaveChangesAsync(cancellationToken);

        var resposta = MapearResposta(disciplina);

        return CreatedAtAction(
            nameof(ObterPorId),
            new { concursoId, id = disciplina.Id },
            resposta);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<DisciplinaEditalResponse>> Atualizar(
        int concursoId,
        int id,
        [FromBody] AtualizarDisciplinaEditalRequest request,
        CancellationToken cancellationToken)
    {
        var disciplina = await _dbContext.DisciplinasEdital
            .FirstOrDefaultAsync(
                disciplina =>
                    disciplina.Id == id &&
                    disciplina.ConcursoId == concursoId,
                cancellationToken);

        if (disciplina is null)
        {
            return NotFound();
        }

        disciplina.Nome = request.Nome.Trim();
        disciplina.Ordem = request.Ordem;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapearResposta(disciplina));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Excluir(
        int concursoId,
        int id,
        CancellationToken cancellationToken)
    {
        var disciplina = await _dbContext.DisciplinasEdital
            .FirstOrDefaultAsync(
                disciplina =>
                    disciplina.Id == id &&
                    disciplina.ConcursoId == concursoId,
                cancellationToken);

        if (disciplina is null)
        {
            return NotFound();
        }

        _dbContext.DisciplinasEdital.Remove(disciplina);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private static DisciplinaEditalResponse MapearResposta(
        DisciplinaEdital disciplina)
    {
        return new DisciplinaEditalResponse(
            disciplina.Id,
            disciplina.ConcursoId,
            disciplina.Nome,
            disciplina.Ordem);
    }
}