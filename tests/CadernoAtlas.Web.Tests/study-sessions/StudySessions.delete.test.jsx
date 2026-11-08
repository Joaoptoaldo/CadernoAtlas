import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within, findByText, render } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch, studySessionFixture } from '../helpers/fetchMocks.js'
import StudySessionsPanel from '../../../src/CadernoAtlas.Web/src/features/study-sessions/StudySessionsPanel'
import { clearAllUncertainTransitions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainTransitions'
import { clearAllUncertainDeletions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainDeletions'

describe('Sessões de estudo — Exclusão', () => {
  beforeEach(() => {
    clearAllUncertainTransitions()
    clearAllUncertainDeletions()
  })

  it('exclui sessão planejada com sucesso (204) e remove da lista', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão para excluir', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para excluir')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))
    expect(await screen.findByText('Nenhuma sessão de estudo encontrada')).toBeInTheDocument()
    expect(screen.queryByText('Sessão para excluir')).not.toBeInTheDocument()
  })

  it('trata 404 na exclusão: sessão não encontrada dispara reconciliação', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão inexistente', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { data: [] },
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão inexistente')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))
    await screen.findByText('Nenhuma sessão de estudo encontrada')
    expect(screen.queryByText('Sessão inexistente')).not.toBeInTheDocument()
  })

  it('trata 409 na exclusão: sessão não é planejada', async () => {
    const session = { ...studySessionFixture, id: 2, titulo: 'Sessão em andamento', situacao: 1 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 409, data: { detail: 'Somente sessões planejadas podem ser excluídas.' } },
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão em andamento')

    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(0)
  })

  it('preserva MutationSyncError quando exclusão confirmada mas GET da lista falha', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão para excluir com sync fail', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { error: new TypeError('Failed to fetch') },
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para excluir com sync fail')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    expect(await screen.findByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByText('Nenhuma sessão de estudo encontrada')).toBeInTheDocument()
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('falha de rede durante DELETE registra incerteza de exclusão', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão para excluir com rede', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para excluir com rede')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Failed to fetch/)

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão para excluir com rede' })

    expect(await screen.findByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })

  it('fechar e reabrir modal preserva incerteza de exclusão', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão persistir incerteza', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão persistir incerteza')

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão persistir incerteza' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    await screen.findByText(/resultado da exclusão é incerto/)

    const closeButtons = screen.getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[0])

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão persistir incerteza' })

    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
  })

  it('botão do card permanece bloqueado quando há incerteza de exclusão', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão card bloqueado', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão card bloqueado')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })

  it('GET individual 404 confirma exclusão e atualiza a lista', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão 404 confirma', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } },
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } },
          { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } },
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { data: [] },
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 404 confirma')

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão 404 confirma' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    await screen.findByText('Nenhuma sessão de estudo encontrada')

    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('GET individual 200 mantém a sessão e atualiza seu estado', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão 200 mantem', situacao: 0 }
    const sessionAfterDelete = { ...session, situacao: 1 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } },
          { status: 200, data: sessionAfterDelete },
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { data: [sessionAfterDelete] },
        ],
      },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 200 mantem')

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão 200 mantem' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    await screen.findByText(/resultado da exclusão é incerto/)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    const modal = screen.getByRole('dialog', { name: /Sessão 200 mantem/i })
    await findByText(modal, 'Em andamento')
    expect(screen.queryByRole('button', { name: 'Excluir sessão' })).not.toBeInTheDocument()
  })

  it('falha de rede durante reconciliação preserva o bloqueio', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão rede reconciliação', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteNetworkFailures: 1,
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } },
          { error: new TypeError('Failed to fetch') },
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão rede reconciliação')

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão rede reconciliação' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    await screen.findByText(/resultado da exclusão é incerto/)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
  })

  it('cancelamento da confirmação não envia DELETE', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão cancelar confirmação', situacao: 0 }
    const fetchMock = setupFetch({ studySessions: [session] })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(false)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão cancelar confirmação')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    expect(fetchMock.getStudySessionDeleteRequests()).toBe(0)
    expect(screen.getByText('Sessão cancelar confirmação')).toBeInTheDocument()
  })

  it('falha na atualização da lista não provoca segundo DELETE', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão sync fail', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { error: new TypeError('Failed to fetch') }, { data: [] },
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão sync fail')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    expect(await screen.findByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await screen.findByText('Nenhuma sessão de estudo encontrada')
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('modal permanece aberto quando exclusão confirmada mas atualização da lista falha (reconcileDelete)', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão modal sync fail', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: session },
          { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } },
        ],
      },
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { error: new TypeError('Failed to fetch') }, { data: [] },
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão modal sync fail')

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão modal sync fail' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    await screen.findByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada. Failed to fetch/)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('MutationSyncError desabilita novo DELETE no card e oferece apenas atualização da lista', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão mutation sync', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { error: new TypeError('Failed to fetch') },
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão mutation sync')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(await screen.findByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    await screen.findByText('Nenhuma sessão de estudo encontrada')

    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('DELETE 404 no card dispara reconciliação automática e atualiza listagem', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão 404 card', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { data: [] },
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 404 card')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    await screen.findByText('Nenhuma sessão de estudo encontrada')
    expect(screen.queryByText('Sessão 404 card')).not.toBeInTheDocument()

    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('DELETE 404 no card com falha na atualização da lista marca sync failed', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão 404 sync fail', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { error: new TypeError('Failed to fetch') }, { data: [] },
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 404 sync fail')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(await screen.findByText(/A sessão foi excluída, mas a lista não pôde ser atualizada/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    await screen.findByText('Nenhuma sessão de estudo encontrada')

    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('exclusões simultâneas no painel mantêm estados isolados por sessão', async () => {
    let rejectSession1
    let resolveSession2

    const promise1 = new Promise((_, rej) => { rejectSession1 = rej })
    const promise2 = new Promise((res) => { resolveSession2 = res })

    const onDeleteMock = vi.fn((id) => {
      if (id === 1) return promise1
      if (id === 2) return promise2
      return Promise.resolve()
    })

    const onReconcileMock = vi.fn().mockResolvedValue()

    const session1 = { ...studySessionFixture, id: 1, titulo: 'Sessão 1 Concorrente', situacao: 0 }
    const session2 = { ...studySessionFixture, id: 2, titulo: 'Sessão 2 Concorrente', situacao: 0 }

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <StudySessionsPanel
        state={{ status: 'success', data: [session1, session2], error: null }}
        onRetry={vi.fn()}
        demands={[]}
        onLoadTasks={vi.fn().mockResolvedValue([])}
        onCreate={vi.fn()}
        onReconcile={onReconcileMock}
        creationOutcomeUnknown={false}
        onCreationOutcomeUnknownChange={vi.fn()}
        onUpdate={vi.fn()}
        onReconcileEdit={vi.fn()}
        onEditOutcomeUnknownChange={vi.fn()}
        onTransition={vi.fn()}
        onDelete={onDeleteMock}
        isTransitioning={false}
        isUncertain={() => false}
        isDeleteUncertain={() => false}
      />
    )

    const cards = screen.getAllByRole('article')
    const card1 = cards.find((c) => within(c).queryByText('Sessão 1 Concorrente'))
    const card2 = cards.find((c) => within(c).queryByText('Sessão 2 Concorrente'))

    const deleteBtn1 = within(card1).getByRole('button', { name: 'Excluir' })
    const deleteBtn2 = within(card2).getByRole('button', { name: 'Excluir' })

    fireEvent.click(deleteBtn1)
    expect(onDeleteMock).toHaveBeenCalledWith(1)

    fireEvent.click(deleteBtn2)
    expect(onDeleteMock).toHaveBeenCalledWith(2)

    expect(within(card1).getByRole('button', { name: 'Excluindo…' })).toBeDisabled()
    expect(within(card2).getByRole('button', { name: 'Excluindo…' })).toBeDisabled()

    rejectSession1(new Error('Falha de rede na sessão 1'))
    await waitFor(() => {
      expect(within(card1).getByText('Falha de rede na sessão 1')).toBeInTheDocument()
    })

    expect(within(card2).queryByText('Falha de rede na sessão 1')).not.toBeInTheDocument()
    expect(within(card2).getByRole('button', { name: 'Excluindo…' })).toBeDisabled()

    resolveSession2()
    await waitFor(() => {
      expect(within(card2).getByRole('button', { name: 'Excluir' })).toBeInTheDocument()
    })

    expect(within(card1).getByText('Falha de rede na sessão 1')).toBeInTheDocument()
    expect(within(card2).queryByText('Falha de rede na sessão 1')).not.toBeInTheDocument()
  })

  it('falha de sincronização em uma sessão não interfere no estado da outra sessão', async () => {
    const session1 = { ...studySessionFixture, id: 1, titulo: 'Sessão 1 Sync Fail', situacao: 0 }
    const session2 = { ...studySessionFixture, id: 2, titulo: 'Sessão 2 Sucesso', situacao: 0 }

    const fetchMock = setupFetch({
      studySessions: [session1, session2],
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session1, session2] },
          { error: new TypeError('Failed to fetch') },
          { data: [session1] },
        ],
      },
    })

    renderApp()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 1 Sync Fail')
    await screen.findByText('Sessão 2 Sucesso')

    const cards = screen.getAllByRole('article')
    const card1 = cards.find((c) => within(c).queryByText('Sessão 1 Sync Fail'))
    const card2 = cards.find((c) => within(c).queryByText('Sessão 2 Sucesso'))

    fireEvent.click(within(card1).getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    await waitFor(() => {
      expect(within(card1).getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    })
    expect(within(card1).getByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada/)).toBeInTheDocument()

    expect(within(card2).queryByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada/)).not.toBeInTheDocument()
    expect(within(card2).getByRole('button', { name: 'Excluir' })).toBeInTheDocument()
    expect(within(card2).queryByRole('button', { name: 'Atualizar lista de sessões' })).not.toBeInTheDocument()

    fireEvent.click(within(card2).getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(2))

    await waitFor(() => {
      expect(screen.queryByText('Sessão 2 Sucesso')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Sessão 1 Sync Fail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
  })

  it('falha real de rede (throw new Error) não interpreta como excluída, preserva incerteza e permite reconciliação', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão Falha Real Rede', situacao: 0 }

    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponses: { 1: { error: new Error('Network error') } },
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: session },
          { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } },
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { data: [] },
        ],
      },
    })

    renderApp()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão Falha Real Rede')

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão Falha Real Rede' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    expect(screen.queryByText(/A exclusão foi confirmada/)).not.toBeInTheDocument()

    await screen.findByText(/resultado da exclusão é incerto/i)
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled()

    const reconcileBtn = screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })
    expect(reconcileBtn).toBeInTheDocument()

    fireEvent.click(reconcileBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    await screen.findByText('Nenhuma sessão de estudo encontrada')

    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('enquanto deleteSyncFailed ativo, iniciar e cancelar estão desabilitados no card', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão sync failed', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { error: new TypeError('Failed to fetch') },
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão sync failed')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })

  it('após reconciliação bem-sucedida, operações voltam a funcionar', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão reconciliação ok', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { error: new TypeError('Failed to fetch') }, { data: [] },
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão reconciliação ok')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    await screen.findByText('Nenhuma sessão de estudo encontrada')

    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })
})