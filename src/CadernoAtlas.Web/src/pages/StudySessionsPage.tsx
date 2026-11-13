import type { ComponentProps } from 'react'
import StudySessionsPanel from '../features/study-sessions/StudySessionsPanel'

interface StudySessionsPageProps extends ComponentProps<typeof StudySessionsPanel> { hidden: boolean }

export default function StudySessionsPage({ hidden, ...panelProps }: StudySessionsPageProps) {
  return <div hidden={hidden}><section className="page-heading"><div><h1>Sessões de estudo</h1><p className="page-subtitle">Consulte as sessões planejadas, em andamento, concluídas ou canceladas.</p></div></section><StudySessionsPanel {...panelProps} /><footer className="page-footer"><span>Sessões organizadas para uma rotina real.</span><span>CadernoAtlas <span className="footer-separator">·</span> Sessões de estudo</span></footer></div>
}
