import type { ComponentProps } from 'react'
import { Dashboard } from './Dashboard'

interface DashboardPageProps extends ComponentProps<typeof Dashboard> { hidden?: boolean }

export default function DashboardPage({ hidden, ...dashboardProps }: DashboardPageProps) {
  return <div hidden={hidden}><section className="page-heading"><div><h1>Dashboard</h1><p className="page-subtitle">Visão geral das suas sessões de estudo e progresso.</p></div></section><Dashboard {...dashboardProps} /><footer className="page-footer"><span>Sessões organizadas para uma rotina real.</span><span>CadernoAtlas <span className="footer-separator">·</span> Dashboard</span></footer></div>
}
