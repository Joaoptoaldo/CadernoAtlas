using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Services;
using Microsoft.EntityFrameworkCore;

var environmentName =
    Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
    ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");

if (string.Equals(
    environmentName,
    "Development",
    StringComparison.OrdinalIgnoreCase))
{
    DotNetEnv.Env.NoClobber().TraversePath().Load();
}

var builder = WebApplication.CreateBuilder(args);

// Serviços da API.
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);

// Fuso horário usado para determinar a data atual na priorização.
var fusoHorarioId = builder.Configuration["FusoHorario"]
    ?? throw new InvalidOperationException(
        "Configuração ausente: FusoHorario");

TimeZoneInfo fusoHorario;

try
{
    fusoHorario = TimeZoneInfo.FindSystemTimeZoneById(fusoHorarioId);
}
catch (TimeZoneNotFoundException)
{
    throw new InvalidOperationException(
        $"Fuso horário inválido: '{fusoHorarioId}'. " +
        "Use um identificador IANA válido, como 'America/Sao_Paulo'.");
}

builder.Services.AddSingleton(fusoHorario);
builder.Services.AddSingleton<PlanejadorSemanal>();

var chaveHmac = builder.Configuration[
    "PlanejamentoSemanal:ChaveHmac"];

if (string.IsNullOrWhiteSpace(chaveHmac))
{
    throw new InvalidOperationException(
        "A chave HMAC do planejamento semanal não foi configurada.");
}

builder.Services.AddSingleton(
    new PlanejamentoSemanalPropostaIdService(chaveHmac));

var connectionString =
    builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "A connection string 'DefaultConnection' não foi configurada.");
}

// Registra o contexto com o provedor PostgreSQL.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

var app = builder.Build();

// Pipeline HTTP.

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // Rota temporária para testar a conexão com o banco.
    app.MapGet(
        "/_dev/database-check",
        async (
            AppDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var canConnect = await dbContext.Database
                .CanConnectAsync(cancellationToken);

            return Results.Json(
                new
                {
                    status = canConnect ? "ok" : "unavailable",
                    database = canConnect ? "connected" : "disconnected"
                },
                statusCode: canConnect
                    ? StatusCodes.Status200OK
                    : StatusCodes.Status503ServiceUnavailable
            );
        });
}


if (!app.Environment.IsEnvironment("Testing"))
{
    app.UseHttpsRedirection();
}

app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program { }