
namespace CadernoAtlas.Api.Models;

public class Caderno
{
    public int Id { get; set; }

    public string Titulo { get; set; } = string.Empty;

    public string? Descricao { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
