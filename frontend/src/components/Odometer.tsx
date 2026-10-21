import { useEffect, useState } from 'react'

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

// Cada dígito é uma coluna de 0 a 9 deslocada por transform: o valor muda, a coluna rola.
export function Odometer({ value }: { value: number }) {
  const [ready, setReady] = useState(false)

  // Começa em zero e passa ao valor real no frame seguinte para a primeira exibição também rolar.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const digits = String(Math.max(0, Math.trunc(value))).split('')

  return (
    <span role="img" aria-label={String(value)} className="inline-flex leading-[1.1]">
      {digits.map((digit, index) => (
        <span
          // A chave conta a partir da direita para que as unidades mantenham a mesma coluna quando o número ganha casas.
          key={digits.length - index}
          aria-hidden="true"
          className="inline-block h-[1.1em] overflow-hidden"
        >
          <span
            className="flex flex-col transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateY(-${(ready ? Number(digit) : 0) * 10}%)` }}
          >
            {DIGITS.map((n) => (
              <span key={n} className="block h-[1.1em]">
                {n}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  )
}
