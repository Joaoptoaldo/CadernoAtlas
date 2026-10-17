using CadernoAtlas.Api.Contracts.DisponibilidadesEstudo;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CadernoAtlas.Api.Controllers;

/// <summary>
/// Controlador responsável por gerenciar as disponibilidades de estudo do usuário.
/// Fornece endpoints para criar e listar disponibilidades de estudo, permitindo que os usuários registrem seus horários disponíveis para estudo e consultem as disponibilidades existentes.
/// </summary>
[ApiController]
[Route("api/disponibilidades-estudo")]
public sealed class DisponibilidadesEstudoController : ControllerBase
{
    private readonly AppDbContext _context;

    public DisponibilidadesEstudoController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<
        ActionResult<IReadOnlyList<DisponibilidadeEstudoResponse>>> Listar(
        [FromQuery] DateOnly? dataDe,
        [FromQuery] DateOnly? dataAte,
        CancellationToken cancellationToken)
    {
        if (dataDe.HasValue
            && dataAte.HasValue
            && dataDe.Value > dataAte.Value)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Período inválido.",
                Detail = "A data inicial deve ser anterior ou igual à data final.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        var consulta = _context.DisponibilidadesEstudo
            .AsNoTracking();

        if (dataDe.HasValue)
        {
            consulta = consulta.Where(
                item => item.Data >= dataDe.Value);
        }

        if (dataAte.HasValue)
        {
            consulta = consulta.Where(
                item => item.Data <= dataAte.Value);
        }

        var disponibilidades = await consulta
            .OrderBy(item => item.Data)
            .ThenBy(item => item.HoraInicio)
            .ThenBy(item => item.Id)
            .Select(item => ParaResposta(item))
            .Select(item => new DisponibilidadeEstudoResponse(
                item.Id,
                item.Data,
                item.HoraInicio,
                item.HoraFim,
                item.CriadoEm))
            .ToListAsync(cancellationToken);

        return Ok(disponibilidades);
    }

    [HttpPost]
    public async Task<ActionResult<DisponibilidadeEstudoResponse>> Criar(
        CriarDisponibilidadeEstudoRequest request,
        CancellationToken cancellationToken)
    {
        var data = request.Data!.Value;
        var horaInicio = request.HoraInicio!.Value;
        var horaFim = request.HoraFim!.Value;

        var existeSobreposicao = await _context.DisponibilidadesEstudo
            .AnyAsync(
                item =>
                    item.Data == data
                    && item.HoraInicio < horaFim
                    && item.HoraFim > horaInicio,
                cancellationToken);

        if (existeSobreposicao)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Disponibilidade sobreposta.",
                Detail = "Já existe uma disponibilidade que se sobrepõe ao intervalo informado.",
                Status = StatusCodes.Status409Conflict
            });
        }

        var disponibilidade = new DisponibilidadeEstudo
        {
            Data = data,
            HoraInicio = horaInicio,
            HoraFim = horaFim
        };

        _context.DisponibilidadesEstudo.Add(disponibilidade);

        await _context.SaveChangesAsync(cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            ParaResposta(disponibilidade));
    }

    private static DisponibilidadeEstudoResponse ParaResposta(
        DisponibilidadeEstudo disponibilidade)
    {
        return new DisponibilidadeEstudoResponse(
            disponibilidade.Id,
            disponibilidade.Data,
            disponibilidade.HoraInicio,
            disponibilidade.HoraFim,
            disponibilidade.CriadoEm);
    }
}