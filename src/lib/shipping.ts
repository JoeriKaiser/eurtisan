export function getCarrierTrackingUrl(carrier: string, trackingNumber: string): string | null {
  switch (carrier) {
    case 'sendcloud':
      return `https://sendcloud.com/tracking?tracking_number=${encodeURIComponent(trackingNumber)}`
    default:
      return null
  }
}
