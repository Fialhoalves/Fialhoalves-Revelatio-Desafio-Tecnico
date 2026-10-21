import { useEffect, useRef } from 'react'

// Ponto que acompanha o mouse e cresce sobre elementos clicáveis. O ponteiro nativo continua
// visível: em uma ferramenta de uso diário, escondê-lo prejudica a precisão do clique.
export function CircleCursor() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    const enabled =
      window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!node || !enabled) return

    const move = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const interactive = target?.closest('a, button, select, label, [role="button"]') != null
      node.style.opacity = '1'
      node.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%) scale(${interactive ? 1.8 : 1})`
    }
    const hide = () => {
      node.style.opacity = '0'
    }

    window.addEventListener('mousemove', move, { passive: true })
    document.addEventListener('mouseleave', hide)
    return () => {
      window.removeEventListener('mousemove', move)
      document.removeEventListener('mouseleave', hide)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[60] size-3 rounded-full bg-white opacity-0 mix-blend-difference transition-[opacity,transform] duration-200 ease-out"
    />
  )
}
