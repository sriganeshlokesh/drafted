import { useState, type CSSProperties, type ElementType, type ComponentPropsWithoutRef } from 'react'

type HoverProps<E extends ElementType> = {
  as?: E
  style?: CSSProperties
  /** Extra style merged on top of `style` while the pointer is over the element. */
  hoverStyle?: CSSProperties
} & Omit<ComponentPropsWithoutRef<E>, 'as' | 'style'>

/**
 * Polymorphic element that applies `hoverStyle` on mouse hover — the React
 * equivalent of the design's `style-hover` attribute.
 */
export function Hover<E extends ElementType = 'div'>({ as, style, hoverStyle, ...rest }: HoverProps<E>) {
  const Tag = (as || 'div') as ElementType
  const [hov, setHov] = useState(false)
  return (
    <Tag
      {...rest}
      style={{ ...style, ...(hov ? hoverStyle : null) }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    />
  )
}
