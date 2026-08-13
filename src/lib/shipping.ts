export function getCarrierTrackingUrl(
  carrier: string,
  trackingNumber: string | null | undefined,
): string | null {
  if (!trackingNumber) return null
  const norm = carrier.toLowerCase().trim()
  switch (norm) {
    case 'dhl':
    case 'deutsche post':
      return `https://www.dhl.com/global-en/home/tracking.html?trackingId=${encodeURIComponent(trackingNumber)}`
    case 'dpd':
      return `https://tracking.dpd.de/status/en_US/parcel/${encodeURIComponent(trackingNumber)}`
    case 'gls':
      return `https://gls-group.eu/EU/en/track-trace?match=${encodeURIComponent(trackingNumber)}`
    case 'postnl':
      return `https://postnl.post/details/track-and-trace/${encodeURIComponent(trackingNumber)}`
    case 'royal mail':
      return `https://www.royalmail.com/track-your-item#/${encodeURIComponent(trackingNumber)}`
    case 'colissimo':
    case 'la poste':
      return `https://www.laposte.fr/outils/suivre-un-envoi?code=${encodeURIComponent(trackingNumber)}`
    case 'packeta':
      return `https://tracking.packeta.com/en_US/?trackingId=${encodeURIComponent(trackingNumber)}`
    default:
      return `https://sendcloud.com/tracking?tracking_number=${encodeURIComponent(trackingNumber)}`
  }
}
