import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="app-shell flex h-screen bg-[var(--color-bg-base)]">
      <Sidebar />
      <div className="app-content flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar />
        <main className="app-main flex-1 overflow-auto p-5">
          {children}
        </main>
      </div>
    </div>
  )
}
