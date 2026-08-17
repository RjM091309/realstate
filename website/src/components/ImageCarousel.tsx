import { useEffect, useRef, useState } from 'react'

type CarouselImage = {
  src: string
  alt: string
}

interface ImageCarouselProps {
  images: CarouselImage[]
  /** Milliseconds between auto-advance. Set 0 to disable. */
  interval?: number
  className?: string
}

export default function ImageCarousel({ images, interval = 5000, className = '' }: ImageCarouselProps) {
  const [active, setActive] = useState(0)
  const [hovering, setHovering] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const goTo = (i: number) => setActive(((i % images.length) + images.length) % images.length)
  const next = () => goTo(active + 1)
  const prev = () => goTo(active - 1)

  useEffect(() => {
    if (!interval || images.length <= 1 || hovering) return
    timerRef.current = setInterval(() => setActive((i) => (i + 1) % images.length), interval)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [interval, images.length, hovering, active])

  if (images.length === 0) return null

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {images.map((img, i) => (
        <img
          key={img.src}
          src={img.src}
          alt={img.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
            i === active ? 'opacity-100' : 'opacity-0'
          }`}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}

      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur-sm flex items-center justify-center text-charcoal hover:bg-white transition-colors z-10"
          >
            ‹
          </button>
          <button
            onClick={next}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur-sm flex items-center justify-center text-charcoal hover:bg-white transition-colors z-10"
          >
            ›
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
            {images.map((img, i) => (
              <button
                key={img.src}
                onClick={() => goTo(i)}
                aria-label={`Go to photo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === active ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>

          <div className="absolute bottom-4 right-4 text-[10px] font-display text-white/80 bg-black/30 px-2 py-0.5 z-10">
            {active + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  )
}
