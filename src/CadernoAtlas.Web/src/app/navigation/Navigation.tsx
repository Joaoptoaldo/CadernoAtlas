import Icon from '../../components/ui/Icon'
import { navigationItems, type NavigationSection } from './navigationItems'

interface NavigationProps {
  activeSection: NavigationSection
  onNavigate: (section: NavigationSection) => void
}

export default function Navigation({ activeSection, onNavigate }: NavigationProps) {
  return <aside className="sidebar"><a className="brand" href="#planejamento" aria-label="CadernoAtlas, planejamento semanal" onClick={() => onNavigate('planning')}>
    <span className="brand-mark"><span /><span />
    <span /></span><span className="brand-wordmark">Caderno<span>Atlas</span></span></a><div className="sidebar-section-label">ESPAÇO DE ESTUDO</div>
    
    <nav className="side-nav" aria-label="Navegação principal">{navigationItems.map((item) => <button key={item.section} className={`nav-item nav-item-button ${activeSection === item.section ? 'nav-item-active' : ''}`} type="button" aria-current={activeSection === item.section ? 'page' : undefined} onClick={() => onNavigate(item.section)} aria-label={item.ariaLabel}><Icon name={item.icon} size={18} /><span>{item.label}</span></button>)}</nav>
    
    <div className="sidebar-bottom"><div className="sidebar-version">CADERNOATLAS <span>·</span> MVP</div></div></aside>
}
