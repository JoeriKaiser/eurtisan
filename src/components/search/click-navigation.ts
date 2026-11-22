import type * as React from 'react'

/**
 * True for a plain primary-button click that will perform an in-tab navigation.
 * Modifier clicks (Cmd/Ctrl/Shift/Alt) and middle-clicks open a new tab or
 * window, so dialogs and overlays should stay open when they happen.
 */
export function isUnmodifiedPrimaryClick(event: React.MouseEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}
