import { studySessionFixture } from '../../helpers/fetchMocks.js'

export const studySessionFixtures = {
  planned: { ...studySessionFixture, id: 1, titulo: 'Sessão Planejada', situacao: 0 },
  inProgress: { ...studySessionFixture, id: 2, titulo: 'Sessão Em Andamento', situacao: 1, inicioRealEm: '2026-11-06T15:00:00Z' },
  completed: { ...studySessionFixture, id: 3, titulo: 'Sessão Concluída', situacao: 2, duracaoRealMinutos: 55, concluidaEm: '2026-11-06T16:00:00Z' },
  cancelled: { ...studySessionFixture, id: 4, titulo: 'Sessão Cancelada', situacao: 3, canceladaEm: '2026-11-06T15:30:00Z' },

  allSituations: [
    { id: 1, titulo: 'Sessão 1 Planejada', dataPlanejada: '2026-11-10', horaInicioPlanejada: '09:00:00', duracaoPlanejadaMinutos: 60, duracaoRealMinutos: null, situacao: 0, demandaAcademicaId: null, tarefaDemandaId: null },
    { id: 2, titulo: 'Sessão 2 Em Andamento', dataPlanejada: '2026-11-12', horaInicioPlanejada: '11:00:00', duracaoPlanejadaMinutos: 60, duracaoRealMinutos: null, situacao: 1, demandaAcademicaId: null, tarefaDemandaId: null },
    { id: 3, titulo: 'Sessão 3 Concluída', dataPlanejada: '2026-11-15', horaInicioPlanejada: '14:00:00', duracaoPlanejadaMinutos: 90, duracaoRealMinutos: 80, situacao: 2, demandaAcademicaId: null, tarefaDemandaId: null },
    { id: 4, titulo: 'Sessão 4 Cancelada', dataPlanejada: '2026-11-20', horaInicioPlanejada: '16:00:00', duracaoPlanejadaMinutos: 45, duracaoRealMinutos: null, situacao: 3, demandaAcademicaId: null, tarefaDemandaId: null },
  ],

  withDemand: { ...studySessionFixture, demandaAcademicaId: 1 },
  withTask: { ...studySessionFixture, tarefaDemandaId: 8 },
  withNotes: { ...studySessionFixture, observacoes: 'Foco na membrana plasmática' },

  makePlanned: (overrides = {}) => ({
    ...studySessionFixture,
    id: Date.now(),
    situacao: 0,
    inicioRealEm: null,
    concluidaEm: null,
    canceladaEm: null,
    ...overrides,
  }),

  makeInProgress: (overrides = {}) => ({
    ...studySessionFixture,
    id: Date.now() + 1,
    situacao: 1,
    inicioRealEm: '2026-11-06T15:00:00Z',
    concluidaEm: null,
    canceladaEm: null,
    ...overrides,
  }),

  makeCompleted: (overrides = {}) => ({
    ...studySessionFixture,
    id: Date.now() + 2,
    situacao: 2,
    inicioRealEm: '2026-11-06T15:00:00Z',
    concluidaEm: '2026-11-06T16:30:00Z',
    duracaoRealMinutos: 90,
    canceladaEm: null,
    ...overrides,
  }),

  makeCancelled: (overrides = {}) => ({
    ...studySessionFixture,
    id: Date.now() + 3,
    situacao: 3,
    canceladaEm: '2026-11-06T15:30:00Z',
    ...overrides,
  }),
}