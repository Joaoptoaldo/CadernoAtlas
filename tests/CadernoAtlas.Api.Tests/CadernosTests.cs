using System.Net;
using System.Net.Http.Json;
using CadernoAtlas.Api.Contracts.Cadernos;

namespace CadernoAtlas.Api.Tests;

public class CadernosTests
{
    [Fact]
    public async Task PutCaderno_Existente_AtualizaDadosERetornaOk()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var criado = await client.PostAsJsonAsync(
            "/api/cadernos",
            new CriarCadernoRequest
            {
                Titulo = "Matemática",
                Descricao = "Descrição inicial"
            });

        var cadernoCriado = await criado.Content
            .ReadFromJsonAsync<CadernoResponse>();

        Assert.NotNull(cadernoCriado);

        var request = new AtualizarCadernoRequest
        {
            Titulo = "Português",
            Descricao = "Descrição atualizada"
        };

        var response = await client.PutAsJsonAsync(
            $"/api/cadernos/{cadernoCriado.Id}",
            request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var atualizado = await response.Content
            .ReadFromJsonAsync<CadernoResponse>();

        Assert.NotNull(atualizado);
        Assert.Equal("Português", atualizado.Titulo);
        Assert.Equal("Descrição atualizada", atualizado.Descricao);
        Assert.Equal(cadernoCriado.Id, atualizado.Id);
    }

    [Fact]
    public async Task PutCaderno_Inexistente_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new AtualizarCadernoRequest
        {
            Titulo = "Matemática",
            Descricao = "Estudos"
        };

        var response = await client.PutAsJsonAsync(
            "/api/cadernos/999",
            request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteCaderno_Existente_RetornaNoContent()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var criado = await client.PostAsJsonAsync(
            "/api/cadernos",
            new CriarCadernoRequest
            {
                Titulo = "Matemática"
            });

        var cadernoCriado = await criado.Content
            .ReadFromJsonAsync<CadernoResponse>();

        Assert.NotNull(cadernoCriado);

        var response = await client.DeleteAsync(
            $"/api/cadernos/{cadernoCriado.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var consulta = await client.GetAsync(
            $"/api/cadernos/{cadernoCriado.Id}");

        Assert.Equal(HttpStatusCode.NotFound, consulta.StatusCode);
    }

    [Fact]
    public async Task DeleteCaderno_Inexistente_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.DeleteAsync("/api/cadernos/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostCadernos_ComTituloMuitoCurto_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new CriarCadernoRequest
        {
            Titulo = "A"
        };

        var response = await client.PostAsJsonAsync(
            "/api/cadernos",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }


    [Fact]
    public async Task PostCadernos_ComDescricaoMuitoLonga_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new CriarCadernoRequest
        {
            Titulo = "Matemática",
            Descricao = new string('A', 1001)
        };

        var response = await client.PostAsJsonAsync(
            "/api/cadernos",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetCadernos_SemRegistros_RetornaListaVazia()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/cadernos");

        response.EnsureSuccessStatusCode();

        var cadernos = await response.Content
            .ReadFromJsonAsync<List<CadernoResponse>>();

        Assert.NotNull(cadernos);
        Assert.Empty(cadernos);
    }

    [Fact]
    public async Task PostCadernos_ComDadosValidos_RetornaCreated()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var request = new CriarCadernoRequest
        {
            Titulo = "Matemática",
            Descricao = "Estudos para concursos"
        };

        var response = await client.PostAsJsonAsync(
            "/api/cadernos",
            request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var caderno = await response.Content
            .ReadFromJsonAsync<CadernoResponse>();

        Assert.NotNull(caderno);
        Assert.Equal("Matemática", caderno.Titulo);
        Assert.Equal("Estudos para concursos", caderno.Descricao);
        Assert.True(caderno.Id > 0);
    }

    [Fact]
    public async Task GetCaderno_Inexistente_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/cadernos/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
