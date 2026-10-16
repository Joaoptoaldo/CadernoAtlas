using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CadernoAtlas.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AdicionarDemandasAcademicas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DemandasAcademicas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Titulo = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Descricao = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Tipo = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Prazo = table.Column<DateOnly>(type: "date", nullable: true),
                    Importancia = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EsforcoEstimadoMinutos = table.Column<int>(type: "integer", nullable: true),
                    Situacao = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemandasAcademicas", x => x.Id);
                    table.CheckConstraint("CK_DemandasAcademicas_EsforcoNaoNegativo", "\"EsforcoEstimadoMinutos\" IS NULL OR \"EsforcoEstimadoMinutos\" >= 0");
                });

            migrationBuilder.CreateTable(
                name: "TarefasDemanda",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DemandaAcademicaId = table.Column<int>(type: "integer", nullable: false),
                    Titulo = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Descricao = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Situacao = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TarefasDemanda", x => x.Id);
                    table.CheckConstraint("CK_TarefasDemanda_OrdemNaoNegativa", "\"Ordem\" >= 0");
                    table.ForeignKey(
                        name: "FK_TarefasDemanda_DemandasAcademicas_DemandaAcademicaId",
                        column: x => x.DemandaAcademicaId,
                        principalTable: "DemandasAcademicas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DemandasAcademicas_Situacao_Prazo",
                table: "DemandasAcademicas",
                columns: new[] { "Situacao", "Prazo" });

            migrationBuilder.CreateIndex(
                name: "IX_TarefasDemanda_DemandaAcademicaId_Ordem",
                table: "TarefasDemanda",
                columns: new[] { "DemandaAcademicaId", "Ordem" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TarefasDemanda");

            migrationBuilder.DropTable(
                name: "DemandasAcademicas");
        }
    }
}
