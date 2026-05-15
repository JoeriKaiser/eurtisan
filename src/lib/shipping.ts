export function getCarrierTrackingUrl(carrier: string, trackingNumber: string): string | null {
  switch (carrier) {
    case 'mondial_relay':
      return `https://www.mondialrelay.com/suivi-de-colis?numeroExpedition=${encodeURIComponent(trackingNumber)}`
    default:
      return null
  }
}
