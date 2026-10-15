using System.Net;
using System.Net.Http.Json;
using CadernoAtlas.Api.Contracts.Concursos;
using CadernoAtlas.Api.Contracts.DisciplinasEdital;
using CadernoAtlas.Api.Contracts.TopicosEdital;
using CadernoAtlas.Api.Models;

namespace CadernoAtlas.Api.Tests;

public class TopicosEditalTests
{
    [Fact]
    public async Task GetTopicos_SemRegistros_RetornaListaVazia()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var concursoId = await CriarConcursoAsync(client);
        var disciplina = await CriarDisciplinaAsync(client, concursoId);

        var response = await client.GetAsync(
            ObterRota(concursoId, disciplina.Id));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var topicos = await response.Content
            .ReadFromJsonAsync<List<TopicoEditalResponse>>();

        Assert.NotNull(topicos);
        Assert.Empty(topicos);
    }

    [Fact]
    public async Task PostTopico_ComDadosValidos_RetornaCreated()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var concursoId = await CriarConcursoAsync(client);
        var disciplina = await CriarDisciplinaAsync(client, concursoId);

        var response = await client.PostAsJsonAsync(
            ObterRota(concursoId, disciplina.Id),
            new CriarTopicoEditalRequest
            {
                Descricao = "Direitos fundamentais",
                Ordem = 1,
                Status = StatusTopicoEdital.Estudando
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var topico = await response.Content
            .ReadFromJsonAsync<TopicoEditalResponse>();

        Assert.NotNull(topico);
        Assert.True(topico.Id > 0);
        Assert.Equal(disciplina.Id, topico.DisciplinaEditalId);
        Assert.Equal("Direitos fundamentais", topico.Descricao);
        Assert.Equal(1, topico.Ordem);
        Assert.Equal("Estudando", topico.Status);
        Assert.Null(topico.TopicoPaiId);
    }

    [Fact]
    public async Task PostTopico_ComPaiDeOutraDisciplina_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var concursoId = await CriarConcursoAsync(client);
        var primeiraDisciplina = await CriarDisciplinaAsync(
            client, concursoId, "Direito Constitucional");
        var segundaDisciplina = await CriarDisciplinaAsync(
            client, concursoId, "Direito Administrativo");

        var pai = await CriarTopicoAsync(
            client, concursoId, primeiraDisciplina.Id,
            "Constituição Federal");

        var response = await client.PostAsJsonAsync(
            ObterRota(concursoId, segundaDisciplina.Id),
            new CriarTopicoEditalRequest
            {
                Descricao = "Organização do Estado",
                Ordem = 1,
                TopicoPaiId = pai.Id
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostTopico_ComDisciplinaDeOutroConcurso_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var primeiroConcursoId = await CriarConcursoAsync(
            client, "Primeiro concurso");
        var segundoConcursoId = await CriarConcursoAsync(
            client, "Segundo concurso");

        var disciplina = await CriarDisciplinaAsync(
            client, primeiroConcursoId);

        var response = await client.PostAsJsonAsync(
            ObterRota(segundoConcursoId, disciplina.Id),
            new CriarTopicoEditalRequest
            {
                Descricao = "Direitos fundamentais",
                Ordem = 1
            });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PutTopico_Existente_AtualizaDadosERetornaOk()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var concursoId = await CriarConcursoAsync(client);
        var disciplina = await CriarDisciplinaAsync(client, concursoId);
        var topico = await CriarTopicoAsync(
            client, concursoId, disciplina.Id, "Descrição inicial");

        var response = await client.PutAsJsonAsync(
            $"{ObterRota(concursoId, disciplina.Id)}/{topico.Id}",
            new AtualizarTopicoEditalRequest
            {
                Descricao = "Descrição atualizada",
                Ordem = 2,
                Status = StatusTopicoEdital.Estudado
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var atualizado = await response.Content
            .ReadFromJsonAsync<TopicoEditalResponse>();

        Assert.NotNull(atualizado);
        Assert.Equal(topico.Id, atualizado.Id);
        Assert.Equal("Descrição atualizada", atualizado.Descricao);
        Assert.Equal(2, atualizado.Ordem);
        Assert.Equal("Estudado", atualizado.Status);
        Assert.Equal(disciplina.Id, atualizado.DisciplinaEditalId);
    }

    [Fact]
    public async Task PutTopico_QueCriariaCiclo_RetornaBadRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var concursoId = await CriarConcursoAsync(client);
        var disciplina = await CriarDisciplinaAsync(client, concursoId);

        var pai = await CriarTopicoAsync(
            client, concursoId, disciplina.Id, "Tópico principal");

        var filho = await CriarTopicoAsync(
            client, concursoId, disciplina.Id, "Subtópico",
            topicoPaiId: pai.Id);

        var response = await client.PutAsJsonAsync(
            $"{ObterRota(concursoId, disciplina.Id)}/{pai.Id}",
            new AtualizarTopicoEditalRequest
            {
                Descricao = "Tópico principal",
                Ordem = 1,
                TopicoPaiId = filho.Id
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTopico_Existente_RetornaNoContent()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var concursoId = await CriarConcursoAsync(client);
        var disciplina = await CriarDisciplinaAsync(client, concursoId);
        var topico = await CriarTopicoAsync(
            client, concursoId, disciplina.Id, "Tópico para excluir");

        var rota = $"{ObterRota(concursoId, disciplina.Id)}/{topico.Id}";
        var response = await client.DeleteAsync(rota);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var consulta = await client.GetAsync(rota);

        Assert.Equal(HttpStatusCode.NotFound, consulta.StatusCode);
    }

    [Fact]
    public async Task GetTopico_PertenceAOutraDisciplina_RetornaNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        await factory.InicializarBancoAsync();
        using var client = factory.CreateClient();

        var concursoId = await CriarConcursoAsync(client);
        var primeiraDisciplina = await CriarDisciplinaAsync(
            client, concursoId, "Direito Constitucional");
        var segundaDisciplina = await CriarDisciplinaAsync(
            client, concursoId, "Direito Administrativo");

        var topico = await CriarTopicoAsync(
            client, concursoId, primeiraDisciplina.Id,
            "Direitos fundamentais");

        var response = await client.GetAsync(
            $"{ObterRota(concursoId, segundaDisciplina.Id)}/{topico.Id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static string ObterRota(int concursoId, int disciplinaId)
    {
        return $"/api/concursos/{concursoId}/disciplinas/{disciplinaId}/topicos";
    }

    private static async Task<int> CriarConcursoAsync(
        HttpClient client,
        string nome = "Concurso de teste")
    {
        var response = await client.PostAsJsonAsync(
            "/api/concursos",
            new CriarConcursoRequest
            {
                Nome = nome,
                Orgao = "Órgão de teste"
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var concurso = await response.Content
            .ReadFromJsonAsync<ConcursoResponse>();

        Assert.NotNull(concurso);

        return concurso.Id;
    }

    private static async Task<DisciplinaEditalResponse> CriarDisciplinaAsync(
        HttpClient client,
        int concursoId,
        string nome = "Direito Constitucional")
    {
        var response = await client.PostAsJsonAsync(
            $"/api/concursos/{concursoId}/disciplinas",
            new CriarDisciplinaEditalRequest
            {
                Nome = nome,
                Ordem = 1
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var disciplina = await response.Content
            .ReadFromJsonAsync<DisciplinaEditalResponse>();

        Assert.NotNull(disciplina);

        return disciplina;
    }

    private static async Task<TopicoEditalResponse> CriarTopicoAsync(
        HttpClient client,
        int concursoId,
        int disciplinaId,
        string descricao,
        int? topicoPaiId = null)
    {
        var response = await client.PostAsJsonAsync(
            ObterRota(concursoId, disciplinaId),
            new CriarTopicoEditalRequest
            {
                Descricao = descricao,
                Ordem = 1,
                TopicoPaiId = topicoPaiId
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var topico = await response.Content
            .ReadFromJsonAsync<TopicoEditalResponse>();

        Assert.NotNull(topico);

        return topico;
    }
}