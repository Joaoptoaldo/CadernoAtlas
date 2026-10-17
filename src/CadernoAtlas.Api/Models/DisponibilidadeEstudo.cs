namespace CadernoAtlas.Api.Models;

public sealed class DisponibilidadeEstudo
{
    public int Id { get; set; }

    public DateOnly Data { get; set; }

    public TimeOnly HoraInicio { get; set; }

    public TimeOnly HoraFim { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}