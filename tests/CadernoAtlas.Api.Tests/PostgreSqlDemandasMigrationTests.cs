using System;
using System.Data.Common;
using System.Linq;
using System.Threading.Tasks;
using CadernoAtlas.Api.Data;
using CadernoAtlas.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using Xunit;

namespace CadernoAtlas.Api.Tests;

[Collection(PostgreSqlSessoesEstudoCollection.Nome)]
[Trait("Category", "PostgreSql")]
public sealed class PostgreSqlDemandasMigrationTests(PostgreSqlSessoesEstudoFixture fixture)
{
    private const string MigrationAnteriorId = "20261017170136_AdicionarEstimativaEsforcoTarefasDemanda";
    private const string MigrationAlvoId = "20261017173404_AlinharEstimativaEsforcoDemandasAcademicas";
    private const string ConstraintAntiga = "CK_DemandasAcademicas_EsforcoNaoNegativo";
    private const string ConstraintNova = "CK_DemandasAcademicas_EsforcoPositivo";

    [Fact]
    public async Task Migration_AlinharEstimativaEsforcoDemandasAcademicas_ConverteZeroEmNull_E_RejeitaZero()
    {
        var schema = $"test_migration_{Guid.NewGuid():N}";
        var connectionString = fixture.ConnectionString;

        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = schema
        };
        var schemaConnectionString = builder.ConnectionString;

        await using var adminConn = new NpgsqlConnection(schemaConnectionString);
        await adminConn.OpenAsync();

        try
        {
            await using (var cmd = adminConn.CreateCommand())
            {
                cmd.CommandText = $@"CREATE SCHEMA IF NOT EXISTS ""{schema}""";
                await cmd.ExecuteNonQueryAsync();
            }

            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(schemaConnectionString)
                .Options;

            var (ctxMigrator, migrator) = GetContextAndMigrator(schemaConnectionString, schema);

            try
            {
                await migrator.MigrateAsync(MigrationAnteriorId);

                var appliedAfterAnterior = (await ctxMigrator.Database.GetAppliedMigrationsAsync()).ToList();
                Assert.Contains(MigrationAnteriorId, appliedAfterAnterior);
                Assert.DoesNotContain(MigrationAlvoId, appliedAfterAnterior);

                await using (var ctx = new AppDbContext(options))
                {
                    var tituloUnico = $"Demanda Migration Teste {Guid.NewGuid():N}";
                    var demanda = new DemandaAcademica
                    {
                        Titulo = tituloUnico,
                        Descricao = "Teste migration zero para NULL",
                        Tipo = TipoDemandaAcademica.Outro,
                        Prazo = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
                        Importancia = ImportanciaDemandaAcademica.Media,
                        EsforcoEstimadoMinutos = 0,
                        Situacao = SituacaoDemandaAcademica.Pendente,
                        CriadoEm = DateTime.UtcNow
                    };

                    ctx.DemandasAcademicas.Add(demanda);
                    await ctx.SaveChangesAsync();

                    var inserida = await ctx.DemandasAcademicas
                        .AsNoTracking()
                        .FirstAsync(d => d.Titulo == tituloUnico);

                    Assert.Equal(0, inserida.EsforcoEstimadoMinutos);
                }

                await using (var checkConn = new NpgsqlConnection(schemaConnectionString))
                {
                    await checkConn.OpenAsync();
                    var constraintAntigaExiste = await ConstraintExiste(checkConn, schema, ConstraintAntiga);
                    Assert.True(constraintAntigaExiste, "Constraint antiga deve existir antes da migration alvo");
                }

                await migrator.MigrateAsync(MigrationAlvoId);

                var appliedAfterAlvo = (await ctxMigrator.Database.GetAppliedMigrationsAsync()).ToList();
                Assert.Contains(MigrationAlvoId, appliedAfterAlvo);

                await using (var ctxLeitura = new AppDbContext(options))
                {
                    var convertida = await ctxLeitura.DemandasAcademicas
                        .AsNoTracking()
                        .FirstAsync(d => d.Titulo.StartsWith("Demanda Migration Teste"));

                    Assert.Null(convertida.EsforcoEstimadoMinutos);
                }

                await using (var checkConn = new NpgsqlConnection(schemaConnectionString))
                {
                    await checkConn.OpenAsync();
                    var constraintNovaExiste = await ConstraintExiste(checkConn, schema, ConstraintNova);
                    Assert.True(constraintNovaExiste, "Constraint nova deve existir após a migration alvo");

                    var constraintAntigaRemovida = await ConstraintExiste(checkConn, schema, ConstraintAntiga);
                    Assert.False(constraintAntigaRemovida, "Constraint antiga deve ter sido removida");
                }

                await using (var ctxTentativa = new AppDbContext(options))
                {
                    var demandaZero = new DemandaAcademica
                    {
                        Titulo = $"Demanda Zero Invalido {Guid.NewGuid():N}",
                        Descricao = "Tentativa de inserir zero após migration",
                        Tipo = TipoDemandaAcademica.Outro,
                        Prazo = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
                        Importancia = ImportanciaDemandaAcademica.Media,
                        EsforcoEstimadoMinutos = 0,
                        Situacao = SituacaoDemandaAcademica.Pendente,
                        CriadoEm = DateTime.UtcNow
                    };

                    ctxTentativa.DemandasAcademicas.Add(demandaZero);

                    var excecao = await Assert.ThrowsAsync<DbUpdateException>(
                        () => ctxTentativa.SaveChangesAsync());

                    var sqlState = ObterSqlState(excecao);
                    Assert.Equal("23514", sqlState);
                }
            }
            finally
            {
                await ctxMigrator.DisposeAsync();
            }
        }
        finally
        {
            await using (var adminConn2 = new NpgsqlConnection(connectionString))
            {
                await adminConn2.OpenAsync();
                await using (var cmd = adminConn2.CreateCommand())
                {
                    cmd.CommandText = $@"DROP SCHEMA IF EXISTS ""{schema}"" CASCADE";
                    await cmd.ExecuteNonQueryAsync();
                }
            }
        }
    }

    private sealed class SearchPathInterceptor(string schema) : DbCommandInterceptor
    {
        public override InterceptionResult<DbDataReader> ReaderExecuting(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result)
        {
            if (command.Connection?.State == System.Data.ConnectionState.Open)
            {
                command.CommandText = $@"SET search_path TO ""{schema}""; " + command.CommandText;
            }
            return result;
        }

        public override InterceptionResult<int> NonQueryExecuting(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<int> result)
        {
            if (command.Connection?.State == System.Data.ConnectionState.Open)
            {
                command.CommandText = $@"SET search_path TO ""{schema}""; " + command.CommandText;
            }
            return result;
        }

        public override InterceptionResult<object> ScalarExecuting(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<object> result)
        {
            if (command.Connection?.State == System.Data.ConnectionState.Open)
            {
                command.CommandText = $@"SET search_path TO ""{schema}""; " + command.CommandText;
            }
            return result;
        }
    }

    private static (AppDbContext Context, IMigrator Migrator) GetContextAndMigrator(string connectionString, string schema)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.CommandTimeout(30);
            })
            .AddInterceptors(new SearchPathInterceptor(schema))
            .Options;

        var ctx = new AppDbContext(options);
        return (ctx, ctx.GetService<IMigrator>());
    }

    private static async Task<bool> ConstraintExiste(NpgsqlConnection connection, string schema, string constraintName)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = $@"
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class cl ON c.conrelid = cl.oid
            JOIN pg_namespace n ON cl.relnamespace = n.oid
            WHERE c.conname = @name
              AND n.nspname = @schema
              AND c.contype = 'c'";
        cmd.Parameters.AddWithValue("name", constraintName);
        cmd.Parameters.AddWithValue("schema", schema);
        var result = await cmd.ExecuteScalarAsync();
        return result != null;
    }

    private static string? ObterSqlState(Exception excecao)
    {
        for (Exception? atual = excecao; atual is not null; atual = atual.InnerException)
        {
            if (atual is PostgresException pgEx)
            {
                return pgEx.SqlState;
            }
        }
        return null;
    }
}