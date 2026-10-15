using CadernoAtlas.Api.Contracts.Concursos;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CadernoAtlas.Api.Controllers;

/// <summary>
/// Habilita a validação automática do DTO.
/// Campos obrigatórios ausentes ou textos que ultrapassem os limites definidos devem resultar em HTTP 400 Bad Request
/// </summary>
[ApiController]
[Route("api/concursos")]
public sealed class ConcursosController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public ConcursosController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ConcursoResponse>>> Listar(
        CancellationToken cancellationToken)
    {
        var concursos = await _dbContext.Concursos
            .AsNoTracking() // reduz o trabalho do EF Core em consultas que não precisam editar as entidades
            .OrderBy(concurso => concurso.Nome)
            .Select(concurso => new ConcursoResponse(
                concurso.Id,
                concurso.Nome,
                concurso.Orgao,
                concurso.Banca,
                concurso.NumeroEdital,
                concurso.DataPublicacao,
                concurso.DataProva,
                concurso.CriadoEm))
            .ToListAsync(cancellationToken);

        return Ok(concursos);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ConcursoResponse>> ObterPorId(
        int id,
        CancellationToken cancellationToken)
    {
        var concurso = await _dbContext.Concursos
            .AsNoTracking()
            .Where(concurso => concurso.Id == id)
            .Select(concurso => new ConcursoResponse(
                concurso.Id,
                concurso.Nome,
                concurso.Orgao,
                concurso.Banca,
                concurso.NumeroEdital,
                concurso.DataPublicacao,
                concurso.DataProva,
                concurso.CriadoEm))
            .FirstOrDefaultAsync(cancellationToken);

        if (concurso is null)
        {
            return NotFound();
        }

        return Ok(concurso);
    }

    [HttpPost]
    public async Task<ActionResult<ConcursoResponse>> Criar(
        [FromBody] CriarConcursoRequest request,
        CancellationToken cancellationToken)
    {
        var concurso = new Concurso
        {
            Nome = request.Nome.Trim(),
            Orgao = request.Orgao.Trim(),
            Banca = NormalizarOpcional(request.Banca),
            NumeroEdital = NormalizarOpcional(request.NumeroEdital),
            DataPublicacao = request.DataPublicacao,
            DataProva = request.DataProva
        };

        _dbContext.Concursos.Add(concurso);

        // persiste o cadastro do concurso no banco de dados, gerando o Id da entidade
        await _dbContext.SaveChangesAsync(cancellationToken);

        var resposta = new ConcursoResponse(
            concurso.Id,
            concurso.Nome,
            concurso.Orgao,
            concurso.Banca,
            concurso.NumeroEdital,
            concurso.DataPublicacao,
            concurso.DataProva,
            concurso.CriadoEm);

        // responde com HTTP 201 e indica a URL para consultar o novo registro.
        return CreatedAtAction(
            nameof(ObterPorId),
            new { id = concurso.Id },
            resposta);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ConcursoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ConcursoResponse>> Atualizar(
        int id,
        AtualizarConcursoRequest request,
        CancellationToken cancellationToken)
    {
        var concurso = await _dbContext.Concursos
            .FirstOrDefaultAsync(
                concurso => concurso.Id == id,
                cancellationToken);

        if (concurso is null)
        {
            return NotFound();
        }

        concurso.Nome = request.Nome.Trim();
        concurso.Orgao = request.Orgao.Trim();
        concurso.Banca = NormalizarOpcional(request.Banca);
        concurso.NumeroEdital = NormalizarOpcional(request.NumeroEdital);
        concurso.DataPublicacao = request.DataPublicacao;
        concurso.DataProva = request.DataProva;

        await _dbContext.SaveChangesAsync(cancellationToken);

        var response = new ConcursoResponse(
            concurso.Id,
            concurso.Nome,
            concurso.Orgao,
            concurso.Banca,
            concurso.NumeroEdital,
            concurso.DataPublicacao,
            concurso.DataProva,
            concurso.CriadoEm);

        return Ok(response);
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Excluir(
        int id,
        CancellationToken cancellationToken)
    {
        var concurso = await _dbContext.Concursos
            .FirstOrDefaultAsync(
                concurso => concurso.Id == id,
                cancellationToken);

        if (concurso is null)
        {
            return NotFound();
        }

        _dbContext.Concursos.Remove(concurso);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private static string? NormalizarOpcional(string? valor)
    {
        return string.IsNullOrWhiteSpace(valor)
            ? null
            : valor.Trim();
    }
}