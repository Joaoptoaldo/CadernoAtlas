using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CadernoAtlas.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AdicionarEstimativaEsforcoTarefasDemanda : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EsforcoEstimadoMinutos",
                table: "TarefasDemanda",
                type: "integer",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_TarefasDemanda_EsforcoNaoNegativo",
                table: "TarefasDemanda",
                sql: "\"EsforcoEstimadoMinutos\" IS NULL OR \"EsforcoEstimadoMinutos\" > 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_TarefasDemanda_EsforcoNaoNegativo",
                table: "TarefasDemanda");

            migrationBuilder.DropColumn(
                name: "EsforcoEstimadoMinutos",
                table: "TarefasDemanda");
        }
    }
}
