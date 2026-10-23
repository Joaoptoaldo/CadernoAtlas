import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPost, apiPut, HttpError } from '../../src/CadernoAtlas.Web/src/apiClient'

afterEach(() => vi.unstubAllGlobals())

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  }
}

describe('apiClient', () => {
  it('envia GET com Accept e signal opcional', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([{ id: 1 }]))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await expect(apiGet('/api/teste', controller.signal)).resolves.toEqual([{ id: 1 }])
    expect(fetchMock).toHaveBeenCalledWith('/api/teste', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  })

  it('prioriza mensagem de validação no POST', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      title: 'One or more validation errors occurred.',
      errors: { Titulo: ['O título é obrigatório.'] },
    }, 400)))

    await expect(apiPost('/api/teste', { titulo: '' })).rejects.toMatchObject({
      name: 'HttpError',
      status: 400,
      message: 'O título é obrigatório.',
    })
  })

  it('retorna HttpError com status e fallback quando PUT falha sem JSON válido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockRejectedValue(new Error('no body')),
    }))

    await expect(apiPut('/api/teste/1', { titulo: 'x' })).rejects.toBeInstanceOf(HttpError)
    await expect(apiPut('/api/teste/1', { titulo: 'x' })).rejects.toMatchObject({
      status: 503,
      message: 'A API respondeu com o status 503.',
    })
  })
})
