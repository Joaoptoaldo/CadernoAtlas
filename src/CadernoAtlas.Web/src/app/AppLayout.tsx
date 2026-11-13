import type { ReactNode } from 'react'
import Navigation from './navigation/Navigation'
import type { NavigationSection } from './navigation/navigationItems'

interface AppLayoutProps {
  activeSection: NavigationSection
  onNavigate: (section: NavigationSection) => void
  children: ReactNode
}

const breadcrumbBySection: Record<NavigationSection, ReactNode> = {
  planning: <>Planejamento <span>/</span> Visão semanal</>,
  dashboard: <>Dashboard <span>/</span> Visão geral</>,
  demands: <>Demandas acadêmicas <span>/</span> Gestão</>,
  'study-sessions': <>Sessões de estudo <span>/</span> Consulta</>,
}

export default function AppLayout({ activeSection, onNavigate, children }: AppLayoutProps) {
  return <div className="app-shell"><a className="skip-link" href="#planejamento">Pular para o conteúdo</a><Navigation activeSection={activeSection} onNavigate={onNavigate} /><main className="main-area" id="planejamento" tabIndex={-1}><header className="topbar"><span className="app-breadcrumb">{breadcrumbBySection[activeSection]}</span><div className="topbar-status"><span className="status-dot" /> Dados da API</div></header><div className="page-content">{children}</div></main></div>
}
