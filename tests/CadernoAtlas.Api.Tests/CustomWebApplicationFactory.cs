using System.Data.Common;
using CadernoAtlas.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CadernoAtlas.Api.Tests;

public sealed class CustomWebApplicationFactory
    : WebApplicationFactory<Program>
{

    public async Task InicializarBancoAsync()
    {
        using var scope = Services.CreateScope();

        var dbContext = scope.ServiceProvider
            .GetRequiredService<AppDbContext>();

        await dbContext.Database.EnsureCreatedAsync();
    }

    protected override void ConfigureWebHost(
        IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.UseSetting("Database:Host", "127.0.0.1");
        builder.UseSetting("Database:Port", "5432");
        builder.UseSetting("Database:Name", "cadernoatlas_test");
        builder.UseSetting("Database:Username", "test");
        builder.UseSetting("Database:Password", "test");
        builder.UseSetting("FusoHorario", "America/Sao_Paulo");


        builder.ConfigureServices(services =>
        {
            services.RemoveAll<
                IDbContextOptionsConfiguration<AppDbContext>>();

            services.RemoveAll<
                DbContextOptions<AppDbContext>>();

            services.RemoveAll<AppDbContext>();
            services.RemoveAll<DbConnection>();

            services.AddSingleton<DbConnection>(_ =>
            {
                var connection = new SqliteConnection(
                    "Data Source=:memory:");

                connection.Open();

                return connection;
            });

            services.AddDbContext<AppDbContext>(
                (serviceProvider, options) =>
                {
                    var connection =
                        serviceProvider.GetRequiredService<DbConnection>();

                    options.UseSqlite(connection);
                });
        });
    }
}
