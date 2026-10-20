import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

export function toIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getCurrentMondayIso() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1)
  }

  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return toIsoDate(date)
}

export const demandFixture = {
  demanda: {
    id: 1,
    titulo: 'Prova de Anatomia',
    tipo: 0,
    descricao: 'Revisar os sistemas do corpo humano',
    esforcoEstimadoMinutos: 120,
    importancia: 2,
  },
  faixaUrgencia: 'Até 3 dias',
  diasAtePrazo: 3,
  justificativa: 'Demanda prioritária para a semana.',
}

export function buildPreview(inicioSemana) {
  return {
    inicioSemana,
    agora: '2026-10-18T10:00:00-03:00',
    propostaId: 'proposta-teste-123',
    alocacoes: [
      {
        dataPlanejada: inicioSemana,
        horaInicio: '09:00:00',
        duracaoPlanejadaMinutos: 60,
        demandaAcademicaId: 1,
        tarefaDemandaId: null,
        titulo: 'Revisar anatomia',
      },
    ],
    naoAlocadas: [
      {
        demandaAcademicaId: 2,
        tarefaDemandaId: null,
        titulo: 'Preparar seminário',
        descricao: 'Revisar os conceitos que ainda faltam.',
        motivo: 2,
      },
    ],
  }
}

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }
}

export function setupFetch({
  demands = [demandFixture],
  allDemands = [
    { id: 1, titulo: 'Demanda gerenciada ativa', descricao: 'Resumo para ficha de estudo', tipo: 0, prazo: '2026-11-01', importancia: 2, esforcoEstimadoMinutos: 120, situacao: 0, criadoEm: '2026-10-01T10:00:00Z' },
    { id: 3, titulo: 'Trabalho concluído', descricao: null, tipo: 1, prazo: null, importancia: 1, esforcoEstimadoMinutos: null, situacao: 2, criadoEm: '2026-09-01T10:00:00Z' },
    { id: 4, titulo: 'Tarefa cancelada', descricao: null, tipo: 4, prazo: '2026-12-01', importancia: 0, esforcoEstimadoMinutos: 30, situacao: 3, criadoEm: '2026-09-02T10:00:00Z' },
  ],
  availability = [
    {
      id: 10,
      data: getCurrentMondayIso(),
      horaInicio: '09:00:00',
      horaFim: '11:00:00',
    },
  ],
  demandFailures = 0,
  allDemandFailures = 0,
  availabilityFailures = 0,
  availabilityPostResponse = {
    status: 201,
    data: {
      id: 11,
      data: getCurrentMondayIso(),
      horaInicio: '10:00:00',
      horaFim: '12:00:00',
    },
  },
  availabilityCreateGate,
  tasksByDemand = {},
  taskResponses = {},
  taskResponseQueues = {},
  taskGates = {},
  taskAbortOnSignal = false,
  taskCreateResponse = null,
  taskCreateResponses = [],
  taskCreateGate,
  taskCreateNetworkFailures = 0,
  taskUpdateResponse = null,
  taskUpdateResponses = [],
  taskUpdateGate,
  taskUpdateNetworkFailures = 0,
  createResponse = {
    status: 201,
    data: {
      id: 2,
      titulo: 'Trabalho de Fisiologia',
      descricao: null,
      tipo: 1,
      prazo: null,
      importancia: 2,
      esforcoEstimadoMinutos: 90,
      situacao: 0,
      criadoEm: '2026-10-18T12:00:00Z',
    },
  },
  createGate,
  updateResponse = null,
  updateGate,
  updateFailures = 0,
  updateFailureResponse = { status: 503, data: { detail: 'Falha temporária ao salvar a demanda.' } },
  postResponse = {
    status: 200,
    data: { sessoesCriadas: [{ id: 101 }] },
  },
  confirmationGate,
  previewOverrides = {},
} = {}) {
  let remainingDemandFailures = demandFailures
  let remainingAllDemandFailures = allDemandFailures
  let remainingUpdateFailures = updateFailures
  let remainingAvailabilityFailures = availabilityFailures
  let currentDemands = demands
  let currentAllDemands = allDemands
  let createdDemand = false
  let demandListRequests = 0
  let demandPostRequests = 0
  let allDemandRequests = 0
  let demandPutRequests = 0
  let previewRequests = 0
  let availabilityRequests = 0
  let availabilityPostRequests = 0
  let confirmationPostRequests = 0
  let taskPostRequests = 0
  let taskPutRequests = 0
  let remainingTaskCreateNetworkFailures = taskCreateNetworkFailures
  let remainingTaskUpdateNetworkFailures = taskUpdateNetworkFailures
  const remainingTaskCreateResponses = [...taskCreateResponses]
  const remainingTaskUpdateResponses = [...taskUpdateResponses]
  const taskRequestCounts = new Map()
  const currentTasksByDemand = Object.fromEntries(
    Object.entries(tasksByDemand).map(([demandId, tasks]) => [Number(demandId), [...tasks]]),
  )
  const remainingTaskResponses = new Map(Object.entries(taskResponseQueues).map(
    ([demandId, responses]) => [Number(demandId), [...responses]],
  ))
  let currentAvailability = availability

  const fetchMock = vi.fn(async (input, init = {}) => {
    const path = String(input)

    if (path === '/api/demandas-academicas' && (init.method === 'GET' || !init.method)) {
      allDemandRequests += 1
      if (remainingAllDemandFailures > 0) {
        remainingAllDemandFailures -= 1
        return jsonResponse({ detail: 'Falha temporária na lista completa.' }, 503)
      }
      return jsonResponse(currentAllDemands)
    }

    if (path === '/api/demandas-academicas/priorizadas') {
      demandListRequests += 1
      if (remainingDemandFailures > 0) {
        remainingDemandFailures -= 1
        return jsonResponse(
          { detail: 'Falha temporária' },
          503,
        )
      }

      return jsonResponse(createdDemand ? [...currentDemands, {
        demanda: createResponse.data,
        faixaUrgencia: 'Até 7 dias',
        diasAtePrazo: null,
        justificativa: 'Nova demanda cadastrada.',
      }] : currentDemands)
    }

    if (path.startsWith('/api/disponibilidades-estudo?')) {
      availabilityRequests += 1
      if (remainingAvailabilityFailures > 0) {
        remainingAvailabilityFailures -= 1
        return jsonResponse(
          { detail: 'Falha temporária ao carregar horários' },
          503,
        )
      }
      return jsonResponse(currentAvailability)
    }

    const taskRoute = path.match(/^\/api\/demandas-academicas\/(\d+)\/tarefas$/)
    if (taskRoute && (!init.method || init.method === 'GET')) {
      const demandId = Number(taskRoute[1])
      taskRequestCounts.set(demandId, (taskRequestCounts.get(demandId) ?? 0) + 1)
      if (taskGates[demandId]) {
        if (taskAbortOnSignal) {
          await Promise.race([
            taskGates[demandId],
            new Promise((resolve, reject) => {
              const abort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
              if (init.signal.aborted) abort()
              else init.signal.addEventListener('abort', abort, { once: true })
            }),
          ])
        } else {
          await taskGates[demandId]
        }
      }
      const responseQueue = remainingTaskResponses.get(demandId)
      const configuredResponse = responseQueue?.length
        ? responseQueue.shift()
        : taskResponses[demandId]
      if (configuredResponse?.error) throw configuredResponse.error
      if (configuredResponse) {
        return jsonResponse(configuredResponse.data, configuredResponse.status)
      }
      return jsonResponse(currentTasksByDemand[demandId] ?? [])
    }

    if (taskRoute && init.method === 'POST') {
      const demandId = Number(taskRoute[1])
      taskPostRequests += 1
      if (taskCreateGate) await taskCreateGate
      if (remainingTaskCreateNetworkFailures > 0) {
        remainingTaskCreateNetworkFailures -= 1
        throw new TypeError('Failed to fetch')
      }
      const response = remainingTaskCreateResponses.shift() ?? taskCreateResponse ?? {
        status: 201,
        data: {
          ...JSON.parse(init.body),
          id: 20 + taskPostRequests,
          demandaAcademicaId: demandId,
          ordem: (currentTasksByDemand[demandId] ?? []).length,
          situacao: 0,
        },
      }
      if (response.status >= 200 && response.status < 300) {
        currentTasksByDemand[demandId] = [...(currentTasksByDemand[demandId] ?? []), response.data]
      }
      return jsonResponse(response.data, response.status)
    }

    const taskUpdateRoute = path.match(/^\/api\/demandas-academicas\/(\d+)\/tarefas\/(\d+)$/)
    if (taskUpdateRoute && init.method === 'PUT') {
      const demandId = Number(taskUpdateRoute[1])
      const taskId = Number(taskUpdateRoute[2])
      taskPutRequests += 1
      if (taskUpdateGate) await taskUpdateGate
      if (remainingTaskUpdateNetworkFailures > 0) {
        remainingTaskUpdateNetworkFailures -= 1
        throw new TypeError('Failed to fetch')
      }
      const response = remainingTaskUpdateResponses.shift() ?? taskUpdateResponse ?? {
        status: 200,
        data: {
          ...JSON.parse(init.body),
          id: taskId,
          demandaAcademicaId: demandId,
        },
      }
      if (response.status >= 200 && response.status < 300) {
        currentTasksByDemand[demandId] = (currentTasksByDemand[demandId] ?? []).map((task) => (
          task.id === taskId ? response.data : task
        ))
      }
      return jsonResponse(response.data, response.status)
    }

    if (path === '/api/disponibilidades-estudo' && init.method === 'POST') {
      availabilityPostRequests += 1
      if (availabilityCreateGate) await availabilityCreateGate
      if (availabilityPostResponse.status >= 200 && availabilityPostResponse.status < 300) {
        currentAvailability = [...currentAvailability, availabilityPostResponse.data]
      }
      return jsonResponse(availabilityPostResponse.data, availabilityPostResponse.status)
    }

    if (path === '/api/demandas-academicas' && init.method === 'POST') {
      demandPostRequests += 1
      if (createGate) await createGate
      if (createResponse.status >= 200 && createResponse.status < 300) {
        createdDemand = true
      }
      return jsonResponse(createResponse.data, createResponse.status)
    }

    if (path.startsWith('/api/demandas-academicas/') && init.method === 'PUT') {
      demandPutRequests += 1
      if (updateGate) await updateGate
      if (remainingUpdateFailures > 0) {
        remainingUpdateFailures -= 1
        return jsonResponse(updateFailureResponse.data, updateFailureResponse.status)
      }
      const response = updateResponse ?? { status: 200, data: { ...JSON.parse(init.body), id: Number(path.split('/').at(-1)), criadoEm: '2026-10-01T10:00:00Z' } }
      if (response.status >= 200 && response.status < 300) {
        const id = Number(path.split('/').at(-1))
        currentAllDemands = currentAllDemands.map((demand) => demand.id === id ? response.data : demand)
        currentDemands = currentDemands.map((item) => {
          const demand = item.demanda ?? item
          return demand.id === id ? { ...item, demanda: response.data } : item
        })
      }
      return jsonResponse(response.data, response.status)
    }

    if (path.startsWith('/api/planejamento-semanal/previa?')) {
      previewRequests += 1
      const url = new URL(path, 'http://localhost')
      const inicioSemana = url.searchParams.get('inicioSemana')
      return jsonResponse({
        ...buildPreview(inicioSemana),
        ...previewOverrides,
      })
    }

    if (
      path === '/api/planejamento-semanal/confirmar' &&
      init.method === 'POST'
    ) {
      confirmationPostRequests += 1
      if (confirmationGate) await confirmationGate
      return jsonResponse(postResponse.data, postResponse.status)
    }

    return jsonResponse({ title: 'Rota de teste não configurada.' }, 404)
  })

  vi.stubGlobal('fetch', fetchMock)
  fetchMock.getDemandListRequests = () => demandListRequests
  fetchMock.getDemandPostRequests = () => demandPostRequests
  fetchMock.getAllDemandRequests = () => allDemandRequests
  fetchMock.getDemandPutRequests = () => demandPutRequests
  fetchMock.getPreviewRequests = () => previewRequests
  fetchMock.getAvailabilityRequests = () => availabilityRequests
  fetchMock.getAvailabilityPostRequests = () => availabilityPostRequests
  fetchMock.getConfirmationPostRequests = () => confirmationPostRequests
  fetchMock.getTaskRequests = (demandId) => demandId === undefined
    ? [...taskRequestCounts.values()].reduce((total, count) => total + count, 0)
    : taskRequestCounts.get(demandId) ?? 0
  fetchMock.getTaskPostRequests = () => taskPostRequests
  fetchMock.getTaskPutRequests = () => taskPutRequests
  return fetchMock
}
