import { useEffect, useState } from 'react'

export function useTema() {
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', escuro)
    try { localStorage.setItem('tema', escuro ? 'escuro' : 'claro') } catch { /* armazenamento indisponível */ }
  }, [escuro])
  return { escuro, alternar: () => setEscuro((v) => !v) }
}
