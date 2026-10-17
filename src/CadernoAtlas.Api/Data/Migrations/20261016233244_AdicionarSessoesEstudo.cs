using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CadernoAtlas.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AdicionarSessoesEstudo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SessoesEstudo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Titulo = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    DataPlanejada = table.Column<DateOnly>(type: "date", nullable: false),
                    HoraInicioPlanejada = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    DuracaoPlanejadaMinutos = table.Column<int>(type: "integer", nullable: false),
                    DuracaoRealMinutos = table.Column<int>(type: "integer", nullable: true),
                    Situacao = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DemandaAcademicaId = table.Column<int>(type: "integer", nullable: true),
                    TarefaDemandaId = table.Column<int>(type: "integer", nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    InicioRealEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ConcluidaEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CanceladaEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SessoesEstudo", x => x.Id);
                    table.CheckConstraint("CK_SessoesEstudo_DuracaoPlanejadaPositiva", "\"DuracaoPlanejadaMinutos\" > 0");
                    table.CheckConstraint("CK_SessoesEstudo_DuracaoRealNaoNegativa", "\"DuracaoRealMinutos\" IS NULL OR \"DuracaoRealMinutos\" >= 0");
                    table.CheckConstraint("CK_SessoesEstudo_VinculoUnico", "\"DemandaAcademicaId\" IS NULL OR \"TarefaDemandaId\" IS NULL");
                    table.ForeignKey(
                        name: "FK_SessoesEstudo_DemandasAcademicas_DemandaAcademicaId",
                        column: x => x.DemandaAcademicaId,
                        principalTable: "DemandasAcademicas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SessoesEstudo_TarefasDemanda_TarefaDemandaId",
                        column: x => x.TarefaDemandaId,
                        principalTable: "TarefasDemanda",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SessoesEstudo_DataPlanejada_HoraInicioPlanejada",
                table: "SessoesEstudo",
                columns: new[] { "DataPlanejada", "HoraInicioPlanejada" });

            migrationBuilder.CreateIndex(
                name: "IX_SessoesEstudo_DemandaAcademicaId",
                table: "SessoesEstudo",
                column: "DemandaAcademicaId");

            migrationBuilder.CreateIndex(
                name: "IX_SessoesEstudo_TarefaDemandaId",
                table: "SessoesEstudo",
                column: "TarefaDemandaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SessoesEstudo");
        }
    }
}
