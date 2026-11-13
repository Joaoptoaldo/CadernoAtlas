import type { ComponentProps } from 'react'
import ManageDemandsPanel from '../features/demands/ManageDemandsPanel'

interface DemandsPageProps extends ComponentProps<typeof ManageDemandsPanel> { hidden: boolean }

export default function DemandsPage({ hidden, ...panelProps }: DemandsPageProps) {
  return <div hidden={hidden}><section className="page-heading"><div><h1>Demandas acadêmicas</h1><p className="page-subtitle">Consulte, filtre e atualize suas demandas.</p></div></section><ManageDemandsPanel {...panelProps} /><footer className="page-footer"><span>Demandas organizadas para uma rotina real.</span><span>CadernoAtlas <span className="footer-separator">·</span> Demandas acadêmicas</span></footer></div>
}
