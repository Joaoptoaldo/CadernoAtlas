import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch, studySessionFixture } from '../helpers/fetchMocks.js'
import { clearAllUncertainTransitions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainTransitions'
import { clearAllUncertainDeletions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainDeletions'

describe('Sessões de estudo — Criação', () => {
  beforeEach(() => {
    clearAllUncertainTransitions()
    clearAllUncertainDeletions()
  })

  it('cria uma sessão sem vínculo e envia somente os campos aceitos pela API', async () => {
    const fetchMock = setupFetch({ studySessions: [] })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))

    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Revisar fisiologia' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.change(within(form).getByLabelText('Duração planejada (minutos)'), { target: { value: '45' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    await waitFor(() => expect(fetchMock.getStudySessionPostRequests()).toBe(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/sessoes-estudo', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        titulo: 'Revisar fisiologia',
        dataPlanejada: '2026-11-20',
        horaInicioPlanejada: '09:30',
        duracaoPlanejadaMinutos: 45,
        demandaAcademicaId: null,
        tarefaDemandaId: null,
        observacoes: null,
      }),
    }))
    expect(await screen.findByText('Revisar fisiologia')).toBeInTheDocument()
  })

  it('carrega tarefas somente da demanda selecionada e não envia demanda e tarefa juntas', async () => {
    const fetchMock = setupFetch({
      studySessions: [],
      tasksByDemand: {
        1: [{ id: 8, demandaAcademicaId: 1, titulo: 'Lista de exercícios', descricao: null, ordem: 0, esforcoEstimadoMinutos: 30, situacao: 0 }],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Demanda acadêmica (opcional)'), { target: { value: '1' } })
    expect(await within(form).findByRole('option', { name: 'Lista de exercícios' })).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Tarefa (opcional)'), { target: { value: '8' } })
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Resolver lista' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    await waitFor(() => expect(fetchMock.getStudySessionPostRequests()).toBe(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/sessoes-estudo', expect.objectContaining({
      body: expect.stringContaining('"demandaAcademicaId":null'),
    }))
    expect(fetchMock).toHaveBeenCalledWith('/api/sessoes-estudo', expect.objectContaining({
      body: expect.stringContaining('"tarefaDemandaId":8'),
    }))
  })

  it('mantém criação incerta sem repetir POST automaticamente', async () => {
    const fetchMock = setupFetch({ studySessions: [], studySessionCreateNetworkFailures: 1 })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Sessão incerta' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))
    expect(await within(form).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
  })

  it('criação confirmada com falha de sincronização e atualização posterior não duplica a sessão', async () => {
    const fetchMock = setupFetch({
      studySessions: [],
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [] }, { data: [] }, { error: new TypeError('Failed to fetch') },
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Sessão não duplicada' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    expect((await screen.findAllByText(/A sessão foi criada, mas a lista não pôde ser atualizada/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    expect(await screen.findByText('Sessão não duplicada')).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)
  })

  it('criação incerta seguida de GET da lista com sucesso, mas sem evidência da criação: formulário continua bloqueado', async () => {
    const fetchMock = setupFetch({
      studySessions: [],
      studySessionCreateNetworkFailures: 1,
      studySessionListQueues: { '/api/sessoes-estudo?': [{ data: [] }, { data: [] }] },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })

    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Sessão sem evidência' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    expect(await within(form).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)

    fireEvent.click(within(form).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' }))

    expect(await within(form).findByText(/Não foi possível confirmar a criação da sessão na lista consultada/)).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
    expect(within(form).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)
  })

  it('criação confirmada com falha de sincronização: atualizar a lista fecha o formulário sem repetir POST', async () => {
    const fetchMock = setupFetch({
      studySessions: [],
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [] }, { data: [] }, { error: new TypeError('Failed to fetch') },
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })

    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Sessão confirmada sync fail' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    expect((await screen.findAllByText(/A sessão foi criada, mas a lista não pôde ser atualizada/)).length).toBeGreaterThan(0)
    expect(within(form).getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)

    fireEvent.click(within(form).getByRole('button', { name: 'Atualizar lista de sessões' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Nova sessão de estudo' })).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Sessão confirmada sync fail')).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)
  })

  it('sessão idêntica preexistente e criação incerta: não assume confirmação automática', async () => {
    const preexistingSession = {
      id: 42,
      titulo: 'Sessão duplicada',
      dataPlanejada: '2026-11-20',
      horaInicioPlanejada: '09:30:00',
      duracaoPlanejadaMinutos: 60,
      duracaoRealMinutos: null,
      situacao: 0,
      demandaAcademicaId: null,
      tarefaDemandaId: null,
      observacoes: null,
      criadoEm: '2026-11-01T10:00:00Z',
      inicioRealEm: null,
      concluidaEm: null,
      canceladaEm: null,
    }

    const fetchMock = setupFetch({
      studySessions: [preexistingSession],
      studySessionCreateNetworkFailures: 1,
      studySessionListQueues: { '/api/sessoes-estudo?': [{ data: [preexistingSession] }] },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })

    expect(screen.getByText('Sessão duplicada')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Sessão duplicada' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    expect(await within(form).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)

    fireEvent.click(within(form).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' }))

    expect(await within(form).findByText(/Não foi possível confirmar a criação da sessão na lista consultada/)).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
    expect(within(form).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)
  })

  it('distingue sessão criada de falha ao atualizar a lista e não repete o POST', async () => {
    const fetchMock = setupFetch({
      studySessions: [studySessionFixture],
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [studySessionFixture] }, { data: [studySessionFixture] }, { error: new TypeError('Failed to fetch') },
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(studySessionFixture.titulo)

    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Sessão confirmada' } })
    fireEvent.change(screen.getByLabelText('Data planejada'), { target: { value: '2026-11-15' } })
    fireEvent.change(screen.getByLabelText('Horário de início'), { target: { value: '16:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar sessão' }))

    expect((await screen.findAllByText(/A sessão foi criada, mas a lista não pôde ser atualizada/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    expect(await screen.findByText('Sessão confirmada')).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)
  })
})