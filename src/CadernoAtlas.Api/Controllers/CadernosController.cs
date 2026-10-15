using CadernoAtlas.Api.Contracts.Cadernos;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CadernoAtlas.Api.Controllers;

[ApiController]
[Route("api/cadernos")]
public sealed class CadernosController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public CadernosController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CadernoResponse>>> Listar(
        CancellationToken cancellationToken)
    {
        var cadernos = await _dbContext.Cadernos
            .AsNoTracking()
            .OrderBy(caderno => caderno.Titulo)
            .Select(caderno => new CadernoResponse(
                caderno.Id,
                caderno.Titulo,
                caderno.Descricao,
                caderno.CriadoEm))
            .ToListAsync(cancellationToken);

        return Ok(cadernos);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CadernoResponse>> ObterPorId(
        int id,
        CancellationToken cancellationToken)
    {
        var caderno = await _dbContext.Cadernos
            .AsNoTracking()
            .Where(caderno => caderno.Id == id)
            .Select(caderno => new CadernoResponse(
                caderno.Id,
                caderno.Titulo,
                caderno.Descricao,
                caderno.CriadoEm))
            .FirstOrDefaultAsync(cancellationToken);

        if (caderno is null)
        {
            return NotFound();
        }

        return Ok(caderno);
    }

    [HttpPost]
    public async Task<ActionResult<CadernoResponse>> Criar(
        [FromBody] CriarCadernoRequest request,
        CancellationToken cancellationToken)
    {
        var caderno = new Caderno
        {
            Titulo = request.Titulo.Trim(),
            Descricao = NormalizarOpcional(request.Descricao)
        };

        _dbContext.Cadernos.Add(caderno);

        await _dbContext.SaveChangesAsync(cancellationToken);

        var resposta = MapearResposta(caderno);

        return CreatedAtAction(
            nameof(ObterPorId),
            new { id = caderno.Id },
            resposta);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CadernoResponse>> Atualizar(
        int id,
        [FromBody] AtualizarCadernoRequest request,
        CancellationToken cancellationToken)
    {
        var caderno = await _dbContext.Cadernos
            .FirstOrDefaultAsync(
                caderno => caderno.Id == id,
                cancellationToken);

        if (caderno is null)
        {
            return NotFound();
        }

        caderno.Titulo = request.Titulo.Trim();
        caderno.Descricao = NormalizarOpcional(request.Descricao);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapearResposta(caderno));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Excluir(
        int id,
        CancellationToken cancellationToken)
    {
        var caderno = await _dbContext.Cadernos
            .FirstOrDefaultAsync(
                caderno => caderno.Id == id,
                cancellationToken);

        if (caderno is null)
        {
            return NotFound();
        }

        _dbContext.Cadernos.Remove(caderno);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private static CadernoResponse MapearResposta(Caderno caderno)
    {
        return new CadernoResponse(
            caderno.Id,
            caderno.Titulo,
            caderno.Descricao,
            caderno.CriadoEm);
    }

    private static string? NormalizarOpcional(string? valor)
    {
        return string.IsNullOrWhiteSpace(valor)
            ? null
            : valor.Trim();
    }
}