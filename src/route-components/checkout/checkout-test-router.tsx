import type { ReactNode } from 'react'

/**
 * Router mock shared by the checkout component tests: the page tree only uses
 * `Link`, rendered here as a plain anchor so assertions can follow hrefs.
 */
export const Link = (props: { children: ReactNode; to: string; className?: string }) => (
  <a href={props.to} className={props.className}>
    {props.children}
  </a>
)
