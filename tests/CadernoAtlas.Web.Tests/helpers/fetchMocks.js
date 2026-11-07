import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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

export const studySessionFixture = {
  id: 1,
  titulo: 'Revisão de Biologia Celular',
  dataPlanejada: '2026-11-10',
  horaInicioPlanejada: '14:00:00',
  duracaoPlanejadaMinutos: 90,
  duracaoRealMinutos: null,
  situacao: 0,
  demandaAcademicaId: 1,
  tarefaDemandaId: null,
  observacoes: 'Foco na membrana plasmática',
  criadoEm: '2026-11-01T10:00:00Z',
  inicioRealEm: null,
  concluidaEm: null,
  canceladaEm: null,
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
  availabilityGetGate,
  availabilityGetError,
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
  taskDeleteResponse = null,
  taskDeleteResponses = [],
  taskDeleteGate,
  taskDeleteNetworkFailures = 0,
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
  allDemandGate,
  allDemandReconcileGate,
  allDemandReconcileFailures = 0,
  studySessions = [studySessionFixture],
  studySessionDetails = {},
  studySessionFailures = 0,
  studySessionReconcileFailures = 0,
  studySessionCreateResponse = null,
  studySessionUpdateResponse = null,
  studySessionDeleteResponse = null,
  studySessionCreateNetworkFailures = 0,
  studySessionUpdateNetworkFailures = 0,
  studySessionDeleteNetworkFailures = 0,
  studySessionTransitionResponses = {},
  studySessionTransitionNetworkFailures = {},
  studySessionReconciliationDetails = {},
  studySessionDetailsQueues = {},
  studySessionListQueues = {},
  studySessionTransitionGate,
  studySessionDeleteGate,
} = {}) {
  const remainingStudySessionDetailsQueues = new Map(
    Object.entries(studySessionDetailsQueues).map(([id, queue]) => [Number(id), [...queue]])
  )
  const remainingStudySessionListQueues = new Map(
    Object.entries(studySessionListQueues).map(([key, queue]) => [key, [...queue]])
  )
  let remainingStudySessionFailures = studySessionFailures
  let remainingStudySessionReconcileFailures = studySessionReconcileFailures
  let currentStudySessions = studySessions
  let remainingStudySessionCreateNetworkFailures = studySessionCreateNetworkFailures
  let remainingStudySessionUpdateNetworkFailures = studySessionUpdateNetworkFailures
  let remainingStudySessionDeleteNetworkFailures = studySessionDeleteNetworkFailures
  const remainingStudySessionTransitionNetworkFailures = { ...studySessionTransitionNetworkFailures }
  let remainingDemandFailures = demandFailures
  let remainingAllDemandFailures = allDemandFailures
  let remainingAllDemandReconcileFailures = allDemandReconcileFailures
  let remainingUpdateFailures = updateFailures
  let remainingAvailabilityGetFailures = availabilityFailures
  let remainingAvailabilityGetError = availabilityGetError
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
  let studySessionPostRequests = 0
  let studySessionPutRequests = 0
  let studySessionDeleteRequests = 0
  let studySessionTransitionRequests = 0
  let studySessionListRequests = 0
  let taskPostRequests = 0
  let taskPutRequests = 0
  let taskDeleteRequests = 0
  let remainingTaskCreateNetworkFailures = taskCreateNetworkFailures
  let remainingTaskUpdateNetworkFailures = taskUpdateNetworkFailures
  let remainingTaskDeleteNetworkFailures = taskDeleteNetworkFailures
  const remainingTaskCreateResponses = [...taskCreateResponses]
  const remainingTaskUpdateResponses = [...taskUpdateResponses]
  const remainingTaskDeleteResponses = [...taskDeleteResponses]
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
      // Wait for reconcile gate on subsequent calls (reconciliation), not initial load
      if (allDemandReconcileGate && allDemandRequests > 1) {
        await allDemandReconcileGate
      }
      // Apply failures for initial load
      if (remainingAllDemandFailures > 0 && allDemandRequests === 1) {
        remainingAllDemandFailures -= 1
        return jsonResponse({ detail: 'Falha temporária na lista completa.' }, 503)
      }
      // Apply failures for reconciliation calls
      // Fail on first request if reconcile failures configured without gate (test doesn't load demands tab first)
      // Or on subsequent requests when gate is used
      if (remainingAllDemandReconcileFailures > 0 && allDemandRequests > 1) {
        remainingAllDemandReconcileFailures -= 1
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
      if (remainingAvailabilityGetFailures > 0) {
        remainingAvailabilityGetFailures -= 1
        return jsonResponse(
          { detail: 'Falha temporária ao carregar horários' },
          503,
        )
      }
      if (availabilityGetGate) {
        await availabilityGetGate
      }
      if (remainingAvailabilityGetError) {
        const errorToThrow = remainingAvailabilityGetError
        remainingAvailabilityGetError = null
        throw errorToThrow
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
      const requestBody = JSON.parse(init.body)
      const existingTasks = currentTasksByDemand[demandId] ?? []
      const maxOrder = Math.max(0, existingTasks.length - 1)
      const requestedOrder = Math.max(0, Math.min(Number(requestBody.ordem) || 0, maxOrder))
      let response = remainingTaskUpdateResponses.shift() ?? taskUpdateResponse ?? {
        status: 200,
        data: {
          ...requestBody,
          id: taskId,
          demandaAcademicaId: demandId,
          ordem: requestedOrder,
        },
      }

      if (response.status >= 200 && response.status < 300) {
        const currentTask = existingTasks.find((task) => task.id === taskId)
        const targetOrder = Math.max(
          0,
          Math.min(Number(response.data?.ordem ?? requestBody.ordem) || 0, maxOrder),
        )
        const updatedTask = {
          ...(currentTask ?? {}),
          ...requestBody,
          ...(response.data ?? {}),
          id: taskId,
          demandaAcademicaId: demandId,
          ordem: targetOrder,
        }
        const reordered = existingTasks.filter((task) => task.id !== taskId)
        reordered.splice(targetOrder, 0, updatedTask)
        currentTasksByDemand[demandId] = reordered.map((task, index) => ({ ...task, ordem: index }))
        response = { ...response, data: updatedTask }
      }

      return jsonResponse(response.data, response.status)
    }


    if (taskUpdateRoute && init.method === 'DELETE') {
      const demandId = Number(taskUpdateRoute[1])
      const taskId = Number(taskUpdateRoute[2])
      taskDeleteRequests += 1
      if (taskDeleteGate) await taskDeleteGate
      if (remainingTaskDeleteNetworkFailures > 0) {
        remainingTaskDeleteNetworkFailures -= 1
        throw new TypeError('Failed to fetch')
      }

      const existingTasks = currentTasksByDemand[demandId] ?? []
      const taskExists = existingTasks.some((task) => task.id === taskId)
      const response = remainingTaskDeleteResponses.shift() ?? taskDeleteResponse ?? (taskExists
        ? { status: 204, data: null }
        : { status: 404, data: { detail: 'Tarefa não encontrada.' } })

      if (response.status >= 200 && response.status < 300) {
        currentTasksByDemand[demandId] = existingTasks.filter((task) => task.id !== taskId)
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
      // Se createResponse tem um error (Error object), lançar para simular falha de rede
      if (createResponse && createResponse.error instanceof Error) {
        throw createResponse.error
      }
      if (createResponse.status >= 200 && createResponse.status < 300) {
        createdDemand = true
        currentAllDemands = [...currentAllDemands, createResponse.data]
      }
      return jsonResponse(createResponse.data, createResponse.status)
    }

    if (path.startsWith('/api/demandas-academicas/') && init.method === 'PUT') {
      demandPutRequests += 1
      if (updateGate) await updateGate
      // Se updateResponse tem um error (Error object), lançar para simular falha de rede
      if (updateResponse && updateResponse.error instanceof Error) {
        throw updateResponse.error
      }
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
      if (postResponse.status >= 200 && postResponse.status < 300) {
        const requestBody = JSON.parse(init.body)
        const createdIds = postResponse.data?.sessoesCriadas ?? []
        currentStudySessions = [
          ...currentStudySessions,
          ...requestBody.alocacoes.map((allocation, index) => ({
            ...allocation,
            horaInicioPlanejada: allocation.horaInicio,
            duracaoPlanejadaMinutos: allocation.duracaoPlanejadaMinutos,
            id: createdIds[index]?.id ?? Math.max(0, ...currentStudySessions.map((session) => session.id)) + index + 1,
            duracaoRealMinutos: null,
            situacao: 0,
            inicioRealEm: null,
            concluidaEm: null,
            canceladaEm: null,
          })),
        ]
      }
      return jsonResponse(postResponse.data, postResponse.status)
    }

    if (path.startsWith('/api/sessoes-estudo')) {
      const transitionMatch = path.match(/^\/api\/sessoes-estudo\/(\d+)\/(iniciar|concluir|cancelar)$/)
      if (transitionMatch && init.method === 'POST') {
        const sessionId = Number(transitionMatch[1])
        const transition = transitionMatch[2]
        const transitionKey = `${sessionId}/${transition}`
        studySessionTransitionRequests += 1
        if (studySessionTransitionGate) await studySessionTransitionGate
        if (remainingStudySessionTransitionNetworkFailures[transitionKey] > 0) {
          remainingStudySessionTransitionNetworkFailures[transitionKey] -= 1
          throw new TypeError('Failed to fetch')
        }
        const existing = currentStudySessions.find((session) => session.id === sessionId)
        const desiredSituation = transition === 'iniciar' ? 1 : transition === 'concluir' ? 2 : 3
        const now = '2026-11-06T15:00:00Z'
        const response = studySessionTransitionResponses[transitionKey] ?? {
          status: existing ? 200 : 404,
          data: existing
            ? {
              ...existing,
              situacao: desiredSituation,
              inicioRealEm: transition === 'iniciar' ? now : existing.inicioRealEm,
              concluidaEm: transition === 'concluir' ? now : existing.concluidaEm,
              canceladaEm: transition === 'cancelar' ? now : existing.canceladaEm,
              duracaoRealMinutos: transition === 'iniciar' ? null : existing.duracaoRealMinutos ?? 0,
            }
            : { detail: 'Sessão não encontrada.' },
        }
        if (response.status >= 200 && response.status < 300) {
          currentStudySessions = currentStudySessions.map((session) => session.id === sessionId ? response.data : session)
        }
        return jsonResponse(response.data, response.status)
      }

      if (init.method === 'POST') {
        studySessionPostRequests += 1
        if (remainingStudySessionCreateNetworkFailures > 0) {
          remainingStudySessionCreateNetworkFailures -= 1
          throw new TypeError('Failed to fetch')
        }
        const requestBody = JSON.parse(init.body)
        const response = studySessionCreateResponse ?? {
          status: 201,
          data: {
            ...requestBody,
            id: Math.max(0, ...currentStudySessions.map((session) => session.id)) + 1,
            situacao: 0,
            duracaoRealMinutos: null,
            criadoEm: '2026-11-06T12:00:00Z',
            inicioRealEm: null,
            concluidaEm: null,
            canceladaEm: null,
          },
        }
        if (response.status >= 200 && response.status < 300) currentStudySessions = [...currentStudySessions, response.data]
        return jsonResponse(response.data, response.status)
      }

      if (init.method === 'PUT') {
        studySessionPutRequests += 1
        if (remainingStudySessionUpdateNetworkFailures > 0) {
          remainingStudySessionUpdateNetworkFailures -= 1
          throw new TypeError('Failed to fetch')
        }
        const sessionId = Number(path.match(/^\/api\/sessoes-estudo\/(\d+)$/)?.[1])
        const requestBody = JSON.parse(init.body)
        const existing = currentStudySessions.find((session) => session.id === sessionId)
        const response = studySessionUpdateResponse ?? {
          status: existing ? 200 : 404,
          data: existing ? { ...existing, ...requestBody } : { detail: 'Sessão não encontrada.' },
        }
        if (response.status >= 200 && response.status < 300) {
          currentStudySessions = currentStudySessions.map((session) => session.id === sessionId ? response.data : session)
        }
        return jsonResponse(response.data, response.status)
      }

      if (init.method === 'DELETE') {
        const sessionId = Number(path.match(/^\/api\/sessoes-estudo\/(\d+)$/)?.[1])
        studySessionDeleteRequests += 1
        if (studySessionDeleteGate) await studySessionDeleteGate
        if (remainingStudySessionDeleteNetworkFailures > 0) {
          remainingStudySessionDeleteNetworkFailures -= 1
          throw new TypeError('Failed to fetch')
        }
        const existing = currentStudySessions.find((session) => session.id === sessionId)
        const response = studySessionDeleteResponse ?? (existing
          ? { status: 204, data: null }
          : { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } })
        if (response.status >= 200 && response.status < 300 && existing) {
          currentStudySessions = currentStudySessions.filter((session) => session.id !== sessionId)
        }
        return jsonResponse(response.data, response.status)
      }

      if (remainingStudySessionFailures > 0) {
        remainingStudySessionFailures -= 1
        return jsonResponse({ title: 'Falha temporária ao carregar sessões.' }, 500)
      }

      const singleSessionMatch = path.match(/^\/api\/sessoes-estudo\/(\d+)$/)
      if (singleSessionMatch) {
        const sessionId = Number(singleSessionMatch[1])
        const queue = remainingStudySessionDetailsQueues.get(sessionId)
        if (queue && queue.length > 0) {
          const next = queue.shift()
          if (next.error) throw next.error
          if (next.status && typeof next.status === 'number') {
            return jsonResponse(next.data ?? { title: 'Sessão de estudo não encontrada.' }, next.status)
          }
          currentStudySessions = currentStudySessions.map((session) => session.id === sessionId ? next : session)
          return jsonResponse(next)
        }
        if (studySessionTransitionRequests > 0) {
          const reconciliationDetail = studySessionReconciliationDetails[sessionId]
          if (reconciliationDetail) {
            currentStudySessions = currentStudySessions.map((session) => session.id === sessionId ? reconciliationDetail : session)
            return jsonResponse(reconciliationDetail)
          }
        }
        const sessionConfig = studySessionDetails[sessionId]
        if (sessionConfig && typeof sessionConfig.status === 'number') {
          return jsonResponse(sessionConfig.data ?? { title: 'Sessão de estudo não encontrada.' }, sessionConfig.status)
        }
        const sessionDetail = sessionConfig ?? currentStudySessions.find((s) => s.id === sessionId)
        if (!sessionDetail) {
          return jsonResponse({ title: 'Sessão de estudo não encontrada.' }, 404)
        }
        return jsonResponse(sessionDetail)
      }

      const url = new URL(path, 'http://localhost')
      studySessionListRequests += 1

      // Support for sequential responses via queues (for pre-creation GET in handleSubmit)
      // Use pathname only to match regardless of query parameters
      const queueKey = url.pathname
      const queue = remainingStudySessionListQueues.get(queueKey)
      if (queue && queue.length > 0) {
        const next = queue.shift()
        if (next.error) throw next.error
        if (next.status && typeof next.status === 'number') {
          return jsonResponse(next.data ?? { title: 'Falha temporária ao atualizar sessões.' }, next.status)
        }
        // next.data contains the array of sessions
        return jsonResponse(next.data)
      }

      if (remainingStudySessionReconcileFailures > 0 && studySessionListRequests > 1) {
        remainingStudySessionReconcileFailures -= 1
        return jsonResponse({ title: 'Falha temporária ao atualizar sessões.' }, 503)
      }
      const dataDe = url.searchParams.get('dataDe')
      const dataAte = url.searchParams.get('dataAte')
      const situacao = url.searchParams.get('situacao')

      let filtered = [...currentStudySessions]
      if (dataDe) filtered = filtered.filter((s) => s.dataPlanejada >= dataDe)
      if (dataAte) filtered = filtered.filter((s) => s.dataPlanejada <= dataAte)
      if (situacao) {
        const situacaoMap = {
          Planejada: 0,
          EmAndamento: 1,
          Concluida: 2,
          Cancelada: 3,
          '0': 0,
          '1': 1,
          '2': 2,
          '3': 3,
        }
        const targetSituacao = situacao in situacaoMap ? situacaoMap[situacao] : Number(situacao)
        filtered = filtered.filter((s) => s.situacao === targetSituacao)
      }

      return jsonResponse(filtered)
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
  fetchMock.getTaskDeleteRequests = () => taskDeleteRequests
  fetchMock.getStudySessionPostRequests = () => studySessionPostRequests
  fetchMock.getStudySessionPutRequests = () => studySessionPutRequests
  fetchMock.getStudySessionDeleteRequests = () => studySessionDeleteRequests
  fetchMock.getStudySessionTransitionRequests = () => studySessionTransitionRequests
  fetchMock.getStudySessionListRequests = () => studySessionListRequests
  return fetchMock
}
