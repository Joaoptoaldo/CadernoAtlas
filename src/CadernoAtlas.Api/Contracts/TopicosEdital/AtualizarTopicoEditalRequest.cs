using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Contracts.TopicosEdital;

public sealed class AtualizarTopicoEditalRequest
{
    [Required]
    [StringLength(500, MinimumLength = 2)]
    public string Descricao { get; init; } = string.Empty;

    [Range(0, int.MaxValue)]
    public int Ordem { get; init; }

    public int? TopicoPaiId { get; init; }

    [EnumDataType(typeof(StatusTopicoEdital))]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public StatusTopicoEdital Status { get; init; }
        = StatusTopicoEdital.Pendente;
}