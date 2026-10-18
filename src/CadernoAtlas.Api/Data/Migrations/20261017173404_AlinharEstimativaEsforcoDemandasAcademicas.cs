using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CadernoAtlas.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AlinharEstimativaEsforcoDemandasAcademicas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_DemandasAcademicas_EsforcoNaoNegativo",
                table: "DemandasAcademicas");

            migrationBuilder.Sql(
                "UPDATE \"DemandasAcademicas\" SET \"EsforcoEstimadoMinutos\" = NULL WHERE \"EsforcoEstimadoMinutos\" = 0;");

            migrationBuilder.AddCheckConstraint(
                name: "CK_DemandasAcademicas_EsforcoPositivo",
                table: "DemandasAcademicas",
                sql: "\"EsforcoEstimadoMinutos\" IS NULL OR \"EsforcoEstimadoMinutos\" > 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException(
                "Esta migration converte estimativas zero em NULL sem preservar quais linhas foram alteradas. " +
                "Restaure um backup anterior à migration antes de reverter este schema.");
        }
    }
}
