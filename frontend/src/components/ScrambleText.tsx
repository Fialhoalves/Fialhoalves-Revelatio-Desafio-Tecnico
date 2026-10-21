import { useEffect, useRef, useState } from 'react'

const GLYPHS = '^$%#@!&*?+='
const DURATION_MS = 420

const canAnimate = () =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Embaralha o texto quando o botão ou link ancestral recebe o mouse. A animação vive aqui,
// e não no botão, para o texto continuar sendo controlado pelo React.
export function ScrambleText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  // Só existe durante a animação; fora dela vale sempre o texto recebido.
  const [scrambled, setScrambled] = useState<string | null>(null)

  useEffect(() => {
    const node = ref.current
    const host = node?.closest<HTMLElement>('button, a')
    if (!node || !host) return

    let timer = 0
    const stop = () => {
      clearInterval(timer)
      node.style.minWidth = ''
      setScrambled(null)
    }
    const run = () => {
      if (!canAnimate() || host.matches(':disabled')) return
      clearInterval(timer)
      // Fixa a largura para o layout não tremer enquanto os glifos trocam de tamanho.
      node.style.minWidth = `${node.offsetWidth}px`
      const start = performance.now()
      // Intervalo em vez de requestAnimationFrame: o texto nunca fica preso embaralhado se a aba pausar os frames.
      timer = window.setInterval(() => {
        const progress = Math.min(1, (performance.now() - start) / DURATION_MS)
        if (progress >= 1) return stop()
        const revealed = Math.floor(progress * text.length)
        setScrambled(
          text
            .split('')
            .map((char, i) => (i < revealed || char === ' ' ? char : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
            .join(''),
        )
      }, 32)
    }

    host.addEventListener('mouseenter', run)
    return () => {
      host.removeEventListener('mouseenter', run)
      stop()
    }
  }, [text])

  return (
    <span ref={ref} className="inline-block text-center" aria-label={text}>
      <span aria-hidden="true">{scrambled ?? text}</span>
    </span>
  )
}
