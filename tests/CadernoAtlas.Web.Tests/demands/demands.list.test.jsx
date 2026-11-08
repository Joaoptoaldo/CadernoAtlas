import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch } from '../helpers/fetchMocks.js'

describe('Demandas acadêmicas — Listagem', () => {
  it('lista demandas ativas, concluídas e canceladas na gestão completa', async () => {
    setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))

    expect(await screen.findByRole('heading', { name: 'Demandas acadêmicas', level: 2 })).toBeInTheDocument()
    expect(await screen.findByText('Demanda gerenciada ativa')).toBeInTheDocument()
    expect(screen.getByText('Trabalho concluído')).toBeInTheDocument()
    expect(screen.getByText('Tarefa cancelada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument()
  })

  it('filtra a lista completa por situação, tipo, importância e prazo máximo', async () => {
    setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')

    fireEvent.change(screen.getByLabelText('Filtrar por situação'), { target: { value: '3' } })
    expect(screen.getByText('Tarefa cancelada')).toBeInTheDocument()
    expect(screen.queryByText('Demanda gerenciada ativa')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filtrar por tipo'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Filtrar por importância'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Filtrar por prazo máximo'), { target: { value: '2026-12-01' } })
    expect(screen.getByText('Tarefa cancelada')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filtrar por prazo máximo'), { target: { value: '2026-11-30' } })
    expect(screen.queryByText('Tarefa cancelada')).not.toBeInTheDocument()
    expect(screen.getByText('Nenhuma demanda encontrada')).toBeInTheDocument()
  })

  it('filtra demandas por tipo independentemente dos outros filtros', async () => {
    setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')

    fireEvent.change(screen.getByLabelText('Filtrar por tipo'), { target: { value: '1' } })

    expect(screen.getByText('Trabalho concluído')).toBeInTheDocument()
    expect(screen.queryByText('Demanda gerenciada ativa')).not.toBeInTheDocument()
    expect(screen.queryByText('Tarefa cancelada')).not.toBeInTheDocument()
  })

  it('filtra demandas por importância independentemente dos outros filtros', async () => {
    setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')

    fireEvent.change(screen.getByLabelText('Filtrar por importância'), { target: { value: '0' } })

    expect(screen.getByText('Tarefa cancelada')).toBeInTheDocument()
    expect(screen.queryByText('Demanda gerenciada ativa')).not.toBeInTheDocument()
    expect(screen.queryByText('Trabalho concluído')).not.toBeInTheDocument()
  })

  it('mostra lista vazia e permite recuperar falha de rede ao carregar demandas', async () => {
    const fetchMock = setupFetch({ allDemands: [], allDemandFailures: 1 })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    expect(await screen.findByText('Falha temporária na lista completa.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhuma demanda encontrada')).toBeInTheDocument()
    expect(fetchMock.getAllDemandRequests()).toBe(2)
  })

  it('mostra o estado vazio quando não há demandas ativas', async () => {
    setupFetch({ demands: [] })
    renderApp()

    expect(
      await screen.findByText('Nenhuma demanda ativa por enquanto'),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Quando você cadastrar provas, trabalhos ou outras demandas, elas aparecerão aqui.',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Nova demanda' }),
    ).toBeInTheDocument()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})