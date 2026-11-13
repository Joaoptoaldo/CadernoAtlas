export type NavigationSection = 'planning' | 'dashboard' | 'demands' | 'study-sessions'

export interface NavigationItem {
  section: NavigationSection
  label: string
  ariaLabel: string
  icon: 'calendar' | 'calendarDays' | 'book' | 'clock'
}

export const navigationItems: NavigationItem[] = [
  { section: 'planning', label: 'Planejamento semanal', ariaLabel: 'Planejamento semanal', icon: 'calendar' },
  { section: 'dashboard', label: 'Dashboard', ariaLabel: 'Dashboard', icon: 'calendarDays' },
  { section: 'demands', label: 'Demandas acadêmicas', ariaLabel: 'Demandas acadêmicas', icon: 'book' },
  { section: 'study-sessions', label: 'Sessões de estudo', ariaLabel: 'Sessões de estudo', icon: 'clock' },
]
