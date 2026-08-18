import { useEffect, useRef, useState } from 'react'
import { animate, useInView, type Variants } from 'framer-motion'

/**
 * Shared scroll-reveal timing — matches the feel of the CSS `fadeUp`/`fadeIn`
 * keyframes in index.css (which stay in place for the hero's continuous
 * zoom/shimmer effects) so swapping the JS mechanism doesn't change the look.
 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: EASE_OUT } },
}

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.65, ease: EASE_OUT } },
}

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.65, ease: EASE_OUT } },
}

/** Put on a grid/list container; children using `fadeUp` (or similar) stagger in automatically. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

/** Standard `whileInView` viewport config — fires once, matches the old useReveal's "disconnect after first hit". */
export const viewportOnce = { once: true, amount: 0.15 } as const

/**
 * Animates a number counting up from 0 when it scrolls into view. Renders as a
 * plain <span> so it drops into existing text (e.g. "1,240+", "₱12B+", "4.9").
 */
export function CountUp({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.4,
  className,
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const [display, setDisplay] = useState(0)
  // Tracks the last rendered value so a changing `value` (e.g. a live filtered
  // count) tweens from wherever the number currently sits instead of always
  // restarting from 0.
  const fromRef = useRef(0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(fromRef.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        setDisplay(v)
        fromRef.current = v
      },
    })
    return () => controls.stop()
  }, [inView, value, duration])

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('en-US')

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
