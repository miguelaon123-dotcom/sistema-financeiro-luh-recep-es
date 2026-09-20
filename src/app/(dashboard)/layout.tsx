import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Lemos o user_id que o Middleware injetou no header após validar o JWT
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  const userEmail = headersList.get('x-user-email') || ''
  const userName = headersList.get('x-user-name') || ''
  const userRole = headersList.get('x-user-role') || 'leitura'

  // Proteção extra (o middleware já faz isso, mas defesa em profundidade)
  if (!userId) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header email={userEmail} name={userName} role={userRole} />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  )
}
