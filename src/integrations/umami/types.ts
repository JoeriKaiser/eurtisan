export interface UmamiClient {
  track(eventName?: string, eventData?: Record<string, unknown>): Promise<string>
}

declare global {
  interface Window {
    umami?: UmamiClient
  }
}
