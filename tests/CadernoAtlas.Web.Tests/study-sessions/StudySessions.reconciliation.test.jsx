import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within, findByText } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch, studySessionFixture } from '../helpers/fetchMocks.js'
import { clearAllUncertainTransitions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainTransitions'
import { clearAllUncertainDeletions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainDeletions'

describe('Sessões de estudo — Reconciliação', () => {
  beforeEach(() => {
    clearAllUncertainTransitions()
    clearAllUncertainDeletions()
  })

  it('reconciliação bem-sucedida no modal libera bloqueios apropriados', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão reconciliação sucesso', situacao: 0 }
    const reconciled = { ...session, situacao: 1 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } },
          { status: 200, data: reconciled },
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { data: [reconciled] },
        ],
      },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão reconciliação sucesso')

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão reconciliação sucesso' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    await screen.findByText(/resultado da exclusão é incerto/)
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    const modal = screen.getByRole('dialog', { name: /Sessão reconciliação sucesso/i })
    await findByText(modal, 'Em andamento')
    expect(screen.queryByText(/resultado da exclusão é incerto/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir sessão' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Concluir sessão' })).not.toBeDisabled()

    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('falhas durante reconciliação no modal não liberam bloqueios indevidamente', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão falha reconciliação', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } },
          { error: new TypeError('Failed to fetch') },
        ],
      },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão falha reconciliação')

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão falha reconciliação' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    await screen.findByText(/resultado da exclusão é incerto/)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    await screen.findByText(/resultado da exclusão é incerto/)

    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()
  })

  it('GET individual 200: sessão continua existindo e interface não informa exclusão confirmada', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão existe', situacao: 0 }
    const reconciled = { ...session, situacao: 1 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } },
          { status: 200, data: reconciled },
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { data: [reconciled] },
        ],
      },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão existe')

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão existe' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    await screen.findByText(/resultado da exclusão é incerto/)
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    const modal = screen.getByRole('dialog', { name: /Sessão existe/i })
    await findByText(modal, 'Em andamento')
    expect(screen.queryByText(/exclusão foi confirmada/)).not.toBeInTheDocument()
    expect(screen.queryByText(/resultado da exclusão é incerto/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir sessão' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Concluir sessão' })).not.toBeDisabled()

    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('GET individual 200 com falha na atualização da lista: mensagem corresponde à situação real', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão falha lista', situacao: 0 }
    const reconciled = { ...session, situacao: 1 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } },
          { status: 200, data: reconciled },
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { error: new TypeError('Failed to fetch') }, { data: [reconciled] },
        ],
      },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão falha lista')

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão falha lista' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    await screen.findByText(/resultado da exclusão é incerto/)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    await screen.findByText(/A sessão ainda existe, mas a lista não pôde ser atualizada/)
    expect(screen.queryByText(/exclusão foi confirmada/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    await findByText(screen.getByRole('dialog', { name: /Sessão falha lista/i }), 'Em andamento')
    expect(screen.queryByText(/A sessão ainda existe, mas a lista não pôde ser atualizada/)).not.toBeInTheDocument()
  })

  it('resultado incerto registrado no card é refletido imediatamente no modal sem fechá-lo', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão incerteza cross', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetails: { 1: session },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão incerteza cross')

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão incerteza cross' })
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).not.toBeDisabled()

    const closeButtons = screen.getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão incerteza cross' })

    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()
  })
})