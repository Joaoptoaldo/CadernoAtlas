using CadernoAtlas.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Serviços da API.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Lê as configurações não secretas.
var databaseHost = builder.Configuration["Database:Host"]
    ?? throw new InvalidOperationException(
        "Configuração ausente: Database:Host");

var databasePort = builder.Configuration.GetValue<int?>("Database:Port")
    ?? throw new InvalidOperationException(
        "Configuração ausente: Database:Port");

var databaseName = builder.Configuration["Database:Name"]
    ?? throw new InvalidOperationException(
        "Configuração ausente: Database:Name");

var databaseUsername = builder.Configuration["Database:Username"]
    ?? throw new InvalidOperationException(
        "Configuração ausente: Database:Username");

// A senha vem do User Secrets durante o desenvolvimento.
var databasePassword = builder.Configuration["Database:Password"]
    ?? throw new InvalidOperationException(
        "Configuração ausente: Database:Password");

// Monta a connection string sem concatenar manualmente os valores.
var connectionStringBuilder = new NpgsqlConnectionStringBuilder
{
    Host = databaseHost,
    Port = databasePort,
    Database = databaseName,
    Username = databaseUsername,
    Password = databasePassword
};

var connectionString = connectionStringBuilder.ConnectionString;

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