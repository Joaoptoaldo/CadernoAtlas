using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace CadernoAtlas.Api.Tests;

public class ConcursosTests
{
    [Fact]
    public async Task GetConcurso_Existente_RetornaConcurso()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();

        using var client = factory.CreateClient();

        var request = new
        {
            nome = "Concurso para Consulta",
            orgao = "Órgão de Teste",
            banca = "FGV"
        };

        var cadastro = await client.PostAsJsonAsync(
            "/api/concursos",
            request);

        Assert.Equal(
            HttpStatusCode.Created,
            cadastro.StatusCode);

        var concursoCriado = await cadastro.Content
            .ReadFromJsonAsync<JsonElement>();

        var id = concursoCriado.GetProperty("id").GetInt32();

        var response = await client.GetAsync(
            $"/api/concursos/{id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var concurso = await response.Content
            .ReadFromJsonAsync<JsonElement>();

        Assert.Equal(
            "Concurso para Consulta",
            concurso.GetProperty("nome").GetString());
    }

    [Fact]
    public async Task PostConcursos_ComNomeEmBranco_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();

        using var client = factory.CreateClient();

        var request = new
        {
            nome = "   ",
            orgao = "Órgão de Teste",
            banca = "FGV"
        };

        var response = await client.PostAsJsonAsync(
            "/api/concursos",
            request);

        Assert.Equal(
            HttpStatusCode.BadRequest,
            response.StatusCode);
    }

    [Fact]
    public async Task GetConcurso_Inexistente_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();

        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/concursos/99999");

        Assert.Equal(
            HttpStatusCode.NotFound,
            response.StatusCode);
    }

    [Fact]
    public async Task PutConcurso_Existente_AtualizaDadosERetornaOk()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();

        using var client = factory.CreateClient();

        var cadastro = new
        {
            nome = "Concurso Original",
            orgao = "Órgão Original",
            banca = "FGV"
        };

        var respostaCadastro = await client.PostAsJsonAsync(
            "/api/concursos",
            cadastro);

        Assert.Equal(
            HttpStatusCode.Created,
            respostaCadastro.StatusCode);

        var concursoCriado = await respostaCadastro.Content
            .ReadFromJsonAsync<JsonElement>();

        var id = concursoCriado.GetProperty("id").GetInt32();

        var atualizacao = new
        {
            nome = "Concurso Atualizado",
            orgao = "Órgão Atualizado",
            banca = "FCC",
            numeroEdital = "002/2026",
            dataPublicacao = "2026-10-05",
            dataProva = "2026-12-20"
        };

        var respostaAtualizacao = await client.PutAsJsonAsync(
            $"/api/concursos/{id}",
            atualizacao);

        Assert.Equal(
            HttpStatusCode.OK,
            respostaAtualizacao.StatusCode);

        var concursoAtualizado = await respostaAtualizacao.Content
            .ReadFromJsonAsync<JsonElement>();

        Assert.Equal(
            "Concurso Atualizado",
            concursoAtualizado.GetProperty("nome").GetString());

        Assert.Equal(
            "Órgão Atualizado",
            concursoAtualizado.GetProperty("orgao").GetString());
    }

    [Fact]
    public async Task PutConcurso_Inexistente_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();

        using var client = factory.CreateClient();

        var atualizacao = new
        {
            nome = "Concurso Atualizado",
            orgao = "Órgão Atualizado",
            banca = "FCC"
        };

        var response = await client.PutAsJsonAsync(
            "/api/concursos/99999",
            atualizacao);

        Assert.Equal(
            HttpStatusCode.NotFound,
            response.StatusCode);
    }
    [Fact]
    public async Task DeleteConcurso_Inexistente_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();

        using var client = factory.CreateClient();

        var response = await client.DeleteAsync("/api/concursos/99999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteConcurso_Existente_RetornaNoContent()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();

        using var client = factory.CreateClient();

        var request = new
        {
            nome = "Concurso para Exclusão",
            orgao = "Órgão de Teste",
            banca = "FGV"
        };

        var cadastro = await client.PostAsJsonAsync(
            "/api/concursos",
            request);

        Assert.Equal(HttpStatusCode.Created, cadastro.StatusCode);

        var concurso = await cadastro.Content
            .ReadFromJsonAsync<JsonElement>();

        var id = concurso.GetProperty("id").GetInt32();

        var response = await client.DeleteAsync(
            $"/api/concursos/{id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
    [Fact]
    public async Task GetConcursos_SemRegistros_RetornaListaVazia()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();

        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/concursos");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var concursos = await response.Content
            .ReadFromJsonAsync<List<JsonElement>>();

        Assert.NotNull(concursos);
        Assert.Empty(concursos);
    }

    [Fact]
    public async Task PostConcursos_ComDadosValidos_RetornaCreated()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();

        using var client = factory.CreateClient();

        var request = new
        {
            nome = "Concurso de Teste",
            orgao = "Órgão de Teste",
            banca = "FGV",
            numeroEdital = "001/2026",
            dataPublicacao = "2026-10-01",
            dataProva = "2026-12-15"
        };

        var response = await client.PostAsJsonAsync(
            "/api/concursos",
            request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var concurso = await response.Content
            .ReadFromJsonAsync<JsonElement>();

        Assert.Equal(
            "Concurso de Teste",
            concurso.GetProperty("nome").GetString());
    }

    [Fact]
    public async Task PostConcursos_SemNome_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();

        using var client = factory.CreateClient();

        var request = new
        {
            nome = "",
            orgao = "Órgão de Teste",
            banca = "FGV",
            numeroEdital = "001/2026",
            dataPublicacao = "2026-10-01",
            dataProva = "2026-12-15"
        };

        var response = await client.PostAsJsonAsync(
            "/api/concursos",
            request);

        Assert.Equal(
            HttpStatusCode.BadRequest,
            response.StatusCode);
    }
}