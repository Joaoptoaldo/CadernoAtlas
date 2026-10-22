using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var environmentName = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
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

// Problem Details para padronização de respostas de erro (RFC 7807).
builder.Services.AddProblemDetails();

// Health Checks.
// - Liveness: verifica se o processo responde (sem dependências externas).
// - Readiness: verifica se a aplicação está pronta, incluindo a disponibilidade
//   do provedor configurado. Em produção usa PostgreSQL; nos testes de integração
//   (ambiente Testing) usa SQLite em memória configurado pela CustomWebApplicationFactory.
builder.Services.AddHealthChecks()
    .AddCheck("liveness", () => HealthCheckResult.Healthy(), tags: ["liveness"])
    .Add(new HealthCheckRegistration(
        "ready",
        sp =>
        {
            var dbContext = sp.GetRequiredService<AppDbContext>();
            return new ReadinessCheck(dbContext);
        },
        HealthStatus.Unhealthy,
        ["ready"],
        TimeSpan.FromSeconds(5)));

var app = builder.Build();

// Pipeline HTTP.

app.UseExceptionHandler();

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

var healthCheckResponseWriter = async (
    HttpContext context,
    HealthReport report) =>
{
    context.Response.ContentType = "application/json; charset=utf-8";
    await context.Response.WriteAsJsonAsync(
        new { status = report.Status.ToString() },
        context.RequestAborted);
};

app.MapHealthChecks(
    "/health/live",
    new HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("liveness"),
        ResponseWriter = healthCheckResponseWriter
    });

app.MapHealthChecks(
    "/health/ready",
    new HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("ready"),
        ResponseWriter = healthCheckResponseWriter
    });

app.MapControllers();

app.Run();

public partial class Program { }

internal sealed class ReadinessCheck(AppDbContext dbContext) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var canConnect = await dbContext.Database
            .CanConnectAsync(cancellationToken);

        return canConnect
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy();
    }
}