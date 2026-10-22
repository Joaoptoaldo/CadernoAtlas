using Microsoft.AspNetCore.Mvc;

namespace CadernoAtlas.Api.Tests;

[ApiController]
[Route("_test/unexpected-exception")]
public sealed class TestExceptionController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        throw new InvalidOperationException(
            "Detalhe interno que não deve ser exposto.");
    }
}
