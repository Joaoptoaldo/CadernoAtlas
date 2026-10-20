import { describe, expect, it } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderApp } from './helpers/renderApp.jsx'
import { setupFetch, buildPreview, getCurrentMondayIso } from './helpers/fetchMocks.js'

describe('Planejamento semanal e acessibilidade', () => {
  it('oferece um link para pular ao conteúdo principal', () => {
    setupFetch()
    renderApp()

    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#planejamento',
    )
  })


  it('permite focar programaticamente o conteúdo principal', () => {
    setupFetch()
    renderApp()

    expect(screen.getByRole('main')).toHaveAttribute('id', 'planejamento')
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
  })


  it('direciona a marca para o planejamento semanal', () => {
    setupFetch()
    renderApp()

    expect(
      screen.getByRole('link', { name: 'CadernoAtlas, planejamento semanal' }),
    ).toHaveAttribute('href', '#planejamento')
  })


  it('retorna ao planejamento ao clicar na marca desde a gestão de demandas', () => {
    setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    expect(screen.getByRole('button', { name: 'Demandas acadêmicas' })).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('link', { name: 'CadernoAtlas, planejamento semanal' }))

    expect(screen.getByRole('button', { name: 'Planejamento semanal' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Demandas acadêmicas' })).not.toHaveAttribute('aria-current', 'page')
  })


  it('associa aria-controls aos formulários somente enquanto estão renderizados', () => {
    setupFetch()
    renderApp()

    const demandFormToggle = screen.getByRole('button', { name: 'Nova demanda' })
    const availabilityFormToggle = screen.getByRole('button', { name: 'Novo horário' })

    expect(demandFormToggle).toHaveAttribute('aria-expanded', 'false')
    expect(demandFormToggle).not.toHaveAttribute('aria-controls')
    expect(availabilityFormToggle).toHaveAttribute('aria-expanded', 'false')
    expect(availabilityFormToggle).not.toHaveAttribute('aria-controls')

    fireEvent.click(demandFormToggle)
    fireEvent.click(availabilityFormToggle)

    expect(demandFormToggle).toHaveAttribute('aria-expanded', 'true')
    expect(demandFormToggle).toHaveAttribute('aria-controls', 'create-demand-form')
    expect(availabilityFormToggle).toHaveAttribute('aria-expanded', 'true')
    expect(availabilityFormToggle).toHaveAttribute(
      'aria-controls',
      'create-availability-form',
    )

    fireEvent.click(
      within(document.getElementById('create-demand-form')).getByRole('button', {
        name: 'Cancelar',
      }),
    )
    fireEvent.click(availabilityFormToggle)

    expect(demandFormToggle).toHaveAttribute('aria-expanded', 'false')
    expect(demandFormToggle).not.toHaveAttribute('aria-controls')
    expect(availabilityFormToggle).toHaveAttribute('aria-expanded', 'false')
    expect(availabilityFormToggle).not.toHaveAttribute('aria-controls')
  })


  it('exibe as demandas e a disponibilidade retornadas pela API', async () => {
    setupFetch()
    renderApp()

    expect(
      await screen.findByRole('heading', { name: 'Prova de Anatomia' }),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Revisar os sistemas do corpo humano'),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { name: 'Disponibilidade' }),
    ).toBeInTheDocument()
  })


  it('permite tentar novamente depois de uma falha ao carregar demandas', async () => {
    const fetchMock = setupFetch({ demandFailures: 1 })
    renderApp()

    expect(await screen.findByText('Falha temporária')).toBeInTheDocument()
    expect(fetchMock.getDemandListRequests()).toBe(1)
    expect(fetchMock.getAvailabilityRequests()).toBe(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Prova de Anatomia' }),
    ).toBeInTheDocument()
    expect(fetchMock.getDemandListRequests()).toBe(2)
    expect(fetchMock.getAvailabilityRequests()).toBe(1)
  })


  it('tenta novamente apenas disponibilidades sem recarregar as demandas', async () => {
    const fetchMock = setupFetch({ availabilityFailures: 1 })
    renderApp()

    expect(
      await screen.findByRole('heading', { name: 'Prova de Anatomia' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Falha temporária ao carregar horários')).toBeInTheDocument()
    expect(fetchMock.getDemandListRequests()).toBe(1)
    expect(fetchMock.getAvailabilityRequests()).toBe(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    )

    expect(await screen.findByText('09:00–11:00')).toBeInTheDocument()
    expect(fetchMock.getDemandListRequests()).toBe(1)
    expect(fetchMock.getAvailabilityRequests()).toBe(2)
  })


  it('exibe as atividades sugeridas e as não alocadas sem salvá-las', async () => {
    const fetchMock = setupFetch()
    renderApp()

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    expect(screen.getByText('Preparar seminário')).toBeInTheDocument()
    expect(
      screen.getByText('Sem disponibilidade na semana'),
    ).toBeInTheDocument()

    const confirmationWasSent = fetchMock.mock.calls.some(
      ([url, options]) =>
        String(url) === '/api/planejamento-semanal/confirmar' &&
        options?.method === 'POST',
    )

    expect(confirmationWasSent).toBe(false)
  })


  it('informa quando nenhuma sessão pode ser alocada e impede a confirmação', async () => {
    const fetchMock = setupFetch({
      previewOverrides: {
        alocacoes: [],
      },
    })

    renderApp()

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(
      await screen.findByText('Nenhuma sessão sugerida'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Preparar seminário'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Revisar os conceitos que ainda faltam.'),
    ).toBeInTheDocument()

    const confirmButton = screen.getByRole('button', {
      name: 'Confirmar planejamento',
    })

    expect(confirmButton).toBeDisabled()

    fireEvent.click(confirmButton)

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/planejamento-semanal/confirmar',
      expect.objectContaining({ method: 'POST' }),
    )
  })


  it('envia os dados da prévia ao confirmar o planejamento', async () => {
    const fetchMock = setupFetch()
    renderApp()

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    )

    expect(
      await screen.findByText('Planejamento confirmado'),
    ).toBeInTheDocument()

    const confirmationCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url) === '/api/planejamento-semanal/confirmar' &&
        options?.method === 'POST',
    )

    expect(confirmationCall).toBeDefined()

    const sentPayload = JSON.parse(confirmationCall[1].body)
    const expectedPreview = buildPreview(getCurrentMondayIso())

    expect(sentPayload).toEqual({
      inicioSemana: expectedPreview.inicioSemana,
      agora: expectedPreview.agora,
      propostaId: expectedPreview.propostaId,
      alocacoes: expectedPreview.alocacoes,
    })
  })


  it('exige uma nova prévia quando a conexão falha durante a confirmação', async () => {
    const fetchMock = setupFetch()
    const originalFetch = fetchMock.getMockImplementation()

    fetchMock.mockImplementation(async (input, init = {}) => {
      if (
        String(input) === '/api/planejamento-semanal/confirmar' &&
        init.method === 'POST'
      ) {
        throw new TypeError('Failed to fetch')
      }

      return originalFetch(input, init)
    })

    renderApp()

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(
      await screen.findByText('Revisar anatomia'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    )

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent(
      'Não foi possível verificar se o planejamento foi salvo',
    )

    expect(
      screen.queryByRole('button', { name: 'Confirmar planejamento' }),
    ).not.toBeInTheDocument()

    const confirmationRequests = () =>
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          String(url) === '/api/planejamento-semanal/confirmar' &&
          options?.method === 'POST',
      )

    expect(confirmationRequests()).toHaveLength(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    )

    expect(
      await screen.findByText('Revisar anatomia'),
    ).toBeInTheDocument()

    const previewRequests = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith('/api/planejamento-semanal/previa?'),
    )

    expect(previewRequests).toHaveLength(2)
    expect(confirmationRequests()).toHaveLength(1)
  })

  it('informa quando a confirmação encontra um conflito HTTP 409', async () => {
    setupFetch({
      postResponse: {
        status: 409,
        data: {
          title: 'Conflito',
          detail: 'A proposta não pode mais ser confirmada.',
        },
      },
    })

    renderApp()

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    )

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('Prévia desatualizada')
    expect(alert).toHaveTextContent(
      'Esta prévia ficou desatualizada ou os horários entraram em conflito.',
    )
    expect(alert).toHaveTextContent(
      'O planejamento não foi salvo. Nenhuma sessão desta proposta foi criada.',
    )

    expect(
      screen.queryByText('Planejamento confirmado'),
    ).not.toBeInTheDocument()

    expect(
      screen.queryByRole('button', { name: 'Confirmar planejamento' }),
    ).not.toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument()
  })


  it('não permite reenviar a mesma prévia após erro HTTP 400 na confirmação', async () => {
    const fetchMock = setupFetch({
      postResponse: {
        status: 400,
        data: {
          detail: 'A proposta enviada é inválida.',
        },
      },
    })

    renderApp()

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(
      await screen.findByText('Revisar anatomia'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A proposta enviada é inválida.',
    )

    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).not.toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    ).toBeDisabled()

    const confirmationRequests = fetchMock.mock.calls.filter(
      ([url, options]) =>
        String(url) === '/api/planejamento-semanal/confirmar' &&
        options?.method === 'POST',
    )

    expect(confirmationRequests).toHaveLength(1)
  })


  it('exige uma nova prévia quando a confirmação retorna HTTP 500', async () => {
    const fetchMock = setupFetch({
      postResponse: {
        status: 500,
        data: {
          detail: 'Falha temporária ao salvar o planejamento.',
        },
      },
    })

    renderApp()

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(
      await screen.findByText('Revisar anatomia'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    )

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent(
      'Não foi possível verificar se o planejamento foi salvo',
    )

    expect(
      screen.queryByRole('button', { name: 'Confirmar planejamento' }),
    ).not.toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Planejamento confirmado'),
    ).not.toBeInTheDocument()

    const confirmationRequests = () =>
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          String(url) === '/api/planejamento-semanal/confirmar' &&
          options?.method === 'POST',
      )

    expect(confirmationRequests()).toHaveLength(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    )

    expect(
      await screen.findByText('Revisar anatomia'),
    ).toBeInTheDocument()

    const previewRequests = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith('/api/planejamento-semanal/previa?'),
    )

    expect(previewRequests).toHaveLength(2)
    expect(confirmationRequests()).toHaveLength(1)
  })


  it('impede confirmação duplicada enquanto a requisição está pendente', async () => {
    let releaseConfirmation
    const confirmationGate = new Promise((resolve) => {
      releaseConfirmation = resolve
    })

    const fetchMock = setupFetch({ confirmationGate })
    renderApp()

    fireEvent.click(
      screen.getByRole('button', { name: 'Gerar prévia' }),
    )

    expect(
      await screen.findByText('Revisar anatomia'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    )

    const pendingButton = await screen.findByRole('button', {
      name: 'Confirmando…',
    })

    expect(pendingButton).toBeDisabled()
    expect(fetchMock.getConfirmationPostRequests()).toBe(1)

    // Simula uma tentativa de segundo clique apesar do bloqueio visual.
    pendingButton.disabled = false
    fireEvent.click(pendingButton)

    expect(fetchMock.getConfirmationPostRequests()).toBe(1)

    releaseConfirmation()

    expect(
      await screen.findByText('Planejamento confirmado'),
    ).toBeInTheDocument()

    expect(fetchMock.getConfirmationPostRequests()).toBe(1)
  })
})