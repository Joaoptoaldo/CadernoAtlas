using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CadernoAtlas.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AdicionarDisponibilidadesEstudo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DisponibilidadesEstudo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Data = table.Column<DateOnly>(type: "date", nullable: false),
                    HoraInicio = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    HoraFim = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DisponibilidadesEstudo", x => x.Id);
                    table.CheckConstraint("CK_DisponibilidadesEstudo_HoraFimPosteriorInicio", "\"HoraFim\" > \"HoraInicio\"");
                });

            migrationBuilder.CreateIndex(
                name: "IX_DisponibilidadesEstudo_Data_HoraInicio",
                table: "DisponibilidadesEstudo",
                columns: new[] { "Data", "HoraInicio" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DisponibilidadesEstudo");
        }
    }
}
