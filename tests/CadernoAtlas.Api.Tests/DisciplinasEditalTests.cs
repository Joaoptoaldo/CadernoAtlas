using System.Net;
using System.Net.Http.Json;
using CadernoAtlas.Api.Contracts.Concursos;
using CadernoAtlas.Api.Contracts.DisciplinasEdital;

namespace CadernoAtlas.Api.Tests;

public class DisciplinasEditalTests
{
    [Fact]
    public async Task GetDisciplinas_SemRegistros_RetornaListaVazia()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var concursoId = await CriarConcursoAsync(
            client,
            "Concurso de teste");

        var response = await client.GetAsync(
            $"/api/concursos/{concursoId}/disciplinas");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var disciplinas = await response.Content
            .ReadFromJsonAsync<List<DisciplinaEditalResponse>>();

        Assert.NotNull(disciplinas);
        Assert.Empty(disciplinas);
    }

    [Fact]
    public async Task PostDisciplina_ComDadosValidos_RetornaCreated()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var concursoId = await CriarConcursoAsync(
            client,
            "Concurso de teste");

        var response = await client.PostAsJsonAsync(
            $"/api/concursos/{concursoId}/disciplinas",
            new CriarDisciplinaEditalRequest
            {
                Nome = "Direito Constitucional",
                Ordem = 1
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var disciplina = await response.Content
            .ReadFromJsonAsync<DisciplinaEditalResponse>();

        Assert.NotNull(disciplina);
        Assert.True(disciplina.Id > 0);
        Assert.Equal(concursoId, disciplina.ConcursoId);
        Assert.Equal("Direito Constitucional", disciplina.Nome);
        Assert.Equal(1, disciplina.Ordem);
    }

    [Fact]
    public async Task PostDisciplina_ConcursoInexistente_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/concursos/999/disciplinas",
            new CriarDisciplinaEditalRequest
            {
                Nome = "Matemática",
                Ordem = 1
            });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetDisciplina_PertenceAOutroConcurso_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var primeiroConcursoId = await CriarConcursoAsync(
            client,
            "Primeiro concurso");

        var segundoConcursoId = await CriarConcursoAsync(
            client,
            "Segundo concurso");

        var disciplina = await CriarDisciplinaAsync(
            client,
            primeiroConcursoId);

        var response = await client.GetAsync(
            $"/api/concursos/{segundoConcursoId}/disciplinas/{disciplina.Id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PutDisciplina_Existente_AtualizaDadosERetornaOk()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var concursoId = await CriarConcursoAsync(
            client,
            "Concurso de teste");

        var disciplina = await CriarDisciplinaAsync(
            client,
            concursoId);

        var response = await client.PutAsJsonAsync(
            $"/api/concursos/{concursoId}/disciplinas/{disciplina.Id}",
            new AtualizarDisciplinaEditalRequest
            {
                Nome = "Direito Administrativo",
                Ordem = 2
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var atualizada = await response.Content
            .ReadFromJsonAsync<DisciplinaEditalResponse>();

        Assert.NotNull(atualizada);
        Assert.Equal(disciplina.Id, atualizada.Id);
        Assert.Equal("Direito Administrativo", atualizada.Nome);
        Assert.Equal(2, atualizada.Ordem);
        Assert.Equal(concursoId, atualizada.ConcursoId);
    }

    [Fact]
    public async Task PutDisciplina_PertenceAOutroConcurso_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var primeiroConcursoId = await CriarConcursoAsync(
            client,
            "Primeiro concurso");

        var segundoConcursoId = await CriarConcursoAsync(
            client,
            "Segundo concurso");

        var disciplina = await CriarDisciplinaAsync(
            client,
            primeiroConcursoId);

        var response = await client.PutAsJsonAsync(
            $"/api/concursos/{segundoConcursoId}/disciplinas/{disciplina.Id}",
            new AtualizarDisciplinaEditalRequest
            {
                Nome = "Tentativa de alteração",
                Ordem = 2
            });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteDisciplina_Existente_RemoveDisciplinaERetornaNoContent()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var concursoId = await CriarConcursoAsync(
            client,
            "Concurso de teste");

        var disciplina = await CriarDisciplinaAsync(
            client,
            concursoId);

        var response = await client.DeleteAsync(
            $"/api/concursos/{concursoId}/disciplinas/{disciplina.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var consulta = await client.GetAsync(
            $"/api/concursos/{concursoId}/disciplinas/{disciplina.Id}");

        Assert.Equal(HttpStatusCode.NotFound, consulta.StatusCode);
    }

    [Fact]
    public async Task DeleteDisciplina_PertenceAOutroConcurso_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var primeiroConcursoId = await CriarConcursoAsync(
            client,
            "Primeiro concurso");

        var segundoConcursoId = await CriarConcursoAsync(
            client,
            "Segundo concurso");

        var disciplina = await CriarDisciplinaAsync(
            client,
            primeiroConcursoId);

        var response = await client.DeleteAsync(
            $"/api/concursos/{segundoConcursoId}/disciplinas/{disciplina.Id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var consulta = await client.GetAsync(
            $"/api/concursos/{primeiroConcursoId}/disciplinas/{disciplina.Id}");

        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);
    }

    private static async Task<int> CriarConcursoAsync(
        HttpClient client,
        string nome)
    {
        var response = await client.PostAsJsonAsync(
            "/api/concursos",
            new CriarConcursoRequest
            {
                Nome = nome,
                Orgao = "Orgao de teste"
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var concurso = await response.Content
            .ReadFromJsonAsync<ConcursoResponse>();

        Assert.NotNull(concurso);

        return concurso.Id;
    }

    private static async Task<DisciplinaEditalResponse> CriarDisciplinaAsync(
        HttpClient client,
        int concursoId)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/concursos/{concursoId}/disciplinas",
            new CriarDisciplinaEditalRequest
            {
                Nome = "Direito Constitucional",
                Ordem = 1
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var disciplina = await response.Content
            .ReadFromJsonAsync<DisciplinaEditalResponse>();

        Assert.NotNull(disciplina);

        return disciplina;
    }
}