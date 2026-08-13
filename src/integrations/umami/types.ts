export interface UmamiClient {
  track(
    eventName?: string | ((props: Record<string, unknown>) => Record<string, unknown>),
    eventData?: Record<string, unknown>,
  ): Promise<string>
}

declare global {
  interface Window {
    umami?: UmamiClient
  }
}
