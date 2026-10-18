using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CadernoAtlas.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ImpedirSobreposicaoSessoesAtivas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Global by design: the current schema has no calendar or owner key.
            // Keep concurrent writes out between the pre-check and constraint creation.
            migrationBuilder.Sql(
                "LOCK TABLE \"SessoesEstudo\" IN SHARE ROW EXCLUSIVE MODE;");

            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM "SessoesEstudo" AS primeira
                        INNER JOIN "SessoesEstudo" AS segunda
                            ON primeira."Id" < segunda."Id"
                        WHERE primeira."Situacao" IN ('Planejada', 'EmAndamento')
                            AND segunda."Situacao" IN ('Planejada', 'EmAndamento')
                            AND tsrange(
                                primeira."DataPlanejada" + primeira."HoraInicioPlanejada",
                                primeira."DataPlanejada" + primeira."HoraInicioPlanejada"
                                    + primeira."DuracaoPlanejadaMinutos" * INTERVAL '1 minute',
                                '[)')
                                && tsrange(
                                    segunda."DataPlanejada" + segunda."HoraInicioPlanejada",
                                    segunda."DataPlanejada" + segunda."HoraInicioPlanejada"
                                        + segunda."DuracaoPlanejadaMinutos" * INTERVAL '1 minute',
                                    '[)')
                        LIMIT 1
                    ) THEN
                        RAISE EXCEPTION
                            'Não é possível criar a constraint: existem sessões ativas com horários sobrepostos em SessoesEstudo.';
                    END IF;
                END;
                $$;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE "SessoesEstudo"
                ADD CONSTRAINT "EX_SessoesEstudo_SemSobreposicaoAtiva"
                EXCLUDE USING gist (
                    (
                        tsrange(
                            "DataPlanejada" + "HoraInicioPlanejada",
                            "DataPlanejada" + "HoraInicioPlanejada"
                                + "DuracaoPlanejadaMinutos" * INTERVAL '1 minute',
                            '[)'
                        )
                    ) WITH &&
                )
                WHERE ("Situacao" IN ('Planejada', 'EmAndamento'));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "ALTER TABLE \"SessoesEstudo\" " +
                "DROP CONSTRAINT \"EX_SessoesEstudo_SemSobreposicaoAtiva\";");
        }
    }
}
