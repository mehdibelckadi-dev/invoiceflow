import { redirect } from 'next/navigation'

// Por ahora redirige al dashboard (cuando exista auth, redirigirá a /login si no hay sesión)
export default function Home() {
  redirect('/dashboard')
}
