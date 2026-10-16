using CadernoAtlas.Api.Contracts.DemandasAcademicas;
using CadernoAtlas.Api.Services;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CadernoAtlas.Api.Controllers;

/// <summary>
/// Controller responsável por gerenciar as demandas acadêmicas.
/// </summary>
[ApiController]
[Route("api/demandas-academicas")]
public sealed class DemandasAcademicasController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly TimeZoneInfo _fusoHorario;

    public DemandasAcademicasController(
        AppDbContext dbContext,
        TimeZoneInfo fusoHorario)
    {
        _dbContext = dbContext;
        _fusoHorario = fusoHorario;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DemandaAcademicaResponse>>> Listar(
        [FromQuery] SituacaoDemandaAcademica? situacao = null,
        [FromQuery] TipoDemandaAcademica? tipo = null,
        [FromQuery] ImportanciaDemandaAcademica? importancia = null,
        [FromQuery] string? prazoAte = null,
        CancellationToken cancellationToken = default)
    {
        DateOnly? prazoAteDate = null;
        if (!string.IsNullOrWhiteSpace(prazoAte))
        {
            if (!DateOnly.TryParseExact(prazoAte, "yyyy-MM-dd", out var dataParsada))
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Data inválida.",
                    Detail = $"O parâmetro 'prazoAte' deve estar no formato 'yyyy-MM-dd'. Valor informado: '{prazoAte}'.",
                    Status = StatusCodes.Status400BadRequest
                });
            }
            prazoAteDate = dataParsada;
        }

        var query = _dbContext.DemandasAcademicas.AsNoTracking();

        if (situacao.HasValue)
        {
            query = query.Where(d => d.Situacao == situacao.Value);
        }

        if (tipo.HasValue)
        {
            query = query.Where(d => d.Tipo == tipo.Value);
        }

        if (importancia.HasValue)
        {
            query = query.Where(d => d.Importancia == importancia.Value);
        }

        if (prazoAteDate.HasValue)
        {
            query = query.Where(d => d.Prazo <= prazoAteDate.Value);
        }

        var demandas = await query
            .OrderBy(demanda => demanda.Titulo)
            .Select(demanda => new DemandaAcademicaResponse(
                demanda.Id,
                demanda.Titulo,
                demanda.Descricao,
                demanda.Tipo,
                demanda.Prazo,
                demanda.Importancia,
                demanda.EsforcoEstimadoMinutos,
                demanda.Situacao,
                demanda.CriadoEm))
            .ToListAsync(cancellationToken);

        return Ok(demandas);
    }

    [HttpGet("priorizadas")]
    public async Task<
        ActionResult<IReadOnlyList<DemandaAcademicaPrioridadeResponse>>>
        ListarPriorizadas(CancellationToken cancellationToken)
    {
        var demandas = await _dbContext.DemandasAcademicas
            .AsNoTracking()
            .Where(d =>
                d.Situacao == SituacaoDemandaAcademica.Pendente ||
                d.Situacao == SituacaoDemandaAcademica.EmAndamento)
            .Select(d => new DemandaAcademicaResponse(
                d.Id,
                d.Titulo,
                d.Descricao,
                d.Tipo,
                d.Prazo,
                d.Importancia,
                d.EsforcoEstimadoMinutos,
                d.Situacao,
                d.CriadoEm))
            .ToListAsync(cancellationToken);

        var hoje = PriorizadorDemandasAcademicas.ObterDataNoFuso(
            DateTime.UtcNow,
            _fusoHorario);

        var prioridades = PriorizadorDemandasAcademicas.Priorizar(
            demandas,
            hoje);

        return Ok(prioridades);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DemandaAcademicaResponse>> ObterPorId(
        int id,
        CancellationToken cancellationToken)
    {
        var demanda = await _dbContext.DemandasAcademicas
            .AsNoTracking()
            .Where(demanda => demanda.Id == id)
            .Select(demanda => new DemandaAcademicaResponse(
                demanda.Id,
                demanda.Titulo,
                demanda.Descricao,
                demanda.Tipo,
                demanda.Prazo,
                demanda.Importancia,
                demanda.EsforcoEstimadoMinutos,
                demanda.Situacao,
                demanda.CriadoEm))
            .FirstOrDefaultAsync(cancellationToken);

        if (demanda is null)
        {
            return NotFound();
        }

        return Ok(demanda);
    }


    [HttpPut("{id:int}")]
    public async Task<ActionResult<DemandaAcademicaResponse>> Atualizar(
        int id,
        [FromBody] AtualizarDemandaAcademicaRequest request,
        CancellationToken cancellationToken)
    {
        var demanda = await _dbContext.DemandasAcademicas
            .FirstOrDefaultAsync(
                demanda => demanda.Id == id,
                cancellationToken);

        if (demanda is null)
        {
            return NotFound();
        }

        if (request.Situacao == SituacaoDemandaAcademica.Concluida)
        {
            var possuiTarefasNaoConcluidas =
                await _dbContext.TarefasDemanda.AnyAsync(
                    tarefa =>
                        tarefa.DemandaAcademicaId == id
                        && tarefa.Situacao != SituacaoTarefaDemanda.Concluida,
                    cancellationToken);

            if (possuiTarefasNaoConcluidas)
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Não é possível concluir a demanda.",
                    Detail = "Conclua ou resolva todas as tarefas antes de concluir a demanda.",
                    Status = StatusCodes.Status400BadRequest
                });
            }
        }

        demanda.Titulo = request.Titulo.Trim();
        demanda.Descricao = NormalizarOpcional(request.Descricao);
        demanda.Tipo = request.Tipo;
        demanda.Prazo = request.Prazo;
        demanda.Importancia = request.Importancia;
        demanda.EsforcoEstimadoMinutos = request.EsforcoEstimadoMinutos;
        demanda.Situacao = request.Situacao;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapearResposta(demanda));
    }

    [HttpPost]
    public async Task<ActionResult<DemandaAcademicaResponse>> Criar(
        [FromBody] CriarDemandaAcademicaRequest request,
        CancellationToken cancellationToken)
    {
        var demanda = new DemandaAcademica
        {
            Titulo = request.Titulo.Trim(),
            Descricao = NormalizarOpcional(request.Descricao),
            Tipo = request.Tipo,
            Prazo = request.Prazo,
            Importancia = request.Importancia,
            EsforcoEstimadoMinutos = request.EsforcoEstimadoMinutos
        };

        _dbContext.DemandasAcademicas.Add(demanda);

        await _dbContext.SaveChangesAsync(cancellationToken);

        var resposta = MapearResposta(demanda);

        return CreatedAtAction(
            nameof(ObterPorId),
            new { id = demanda.Id },
            resposta);
    }

    private static DemandaAcademicaResponse MapearResposta(
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

    private static string? NormalizarOpcional(string? valor)
    {
        return string.IsNullOrWhiteSpace(valor)
            ? null
            : valor.Trim();
    }
}