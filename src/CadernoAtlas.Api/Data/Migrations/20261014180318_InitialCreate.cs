using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CadernoAtlas.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Cadernos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Titulo = table.Column<string>(type: "text", nullable: false),
                    Descricao = table.Column<string>(type: "text", nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cadernos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Concursos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nome = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Orgao = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Banca = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    NumeroEdital = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    DataPublicacao = table.Column<DateOnly>(type: "date", nullable: true),
                    DataProva = table.Column<DateOnly>(type: "date", nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Concursos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DisciplinasEdital",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ConcursoId = table.Column<int>(type: "integer", nullable: false),
                    Nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DisciplinasEdital", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DisciplinasEdital_Concursos_ConcursoId",
                        column: x => x.ConcursoId,
                        principalTable: "Concursos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TopicosEdital",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DisciplinaEditalId = table.Column<int>(type: "integer", nullable: false),
                    TopicoPaiId = table.Column<int>(type: "integer", nullable: true),
                    Descricao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TopicosEdital", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TopicosEdital_DisciplinasEdital_DisciplinaEditalId",
                        column: x => x.DisciplinaEditalId,
                        principalTable: "DisciplinasEdital",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TopicosEdital_TopicosEdital_TopicoPaiId",
                        column: x => x.TopicoPaiId,
                        principalTable: "TopicosEdital",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DisciplinasEdital_ConcursoId_Ordem",
                table: "DisciplinasEdital",
                columns: new[] { "ConcursoId", "Ordem" });

            migrationBuilder.CreateIndex(
                name: "IX_TopicosEdital_DisciplinaEditalId_Ordem",
                table: "TopicosEdital",
                columns: new[] { "DisciplinaEditalId", "Ordem" });

            migrationBuilder.CreateIndex(
                name: "IX_TopicosEdital_TopicoPaiId",
                table: "TopicosEdital",
                column: "TopicoPaiId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Cadernos");

            migrationBuilder.DropTable(
                name: "TopicosEdital");

            migrationBuilder.DropTable(
                name: "DisciplinasEdital");

            migrationBuilder.DropTable(
                name: "Concursos");
        }
    }
}
