export type {
  Label,
  Package,
  Rate,
  ShipmentDetails,
  ShippingAddress,
  ShippingProvider,
  TrackingEvent,
  TrackingInfo,
} from '#/lib/shipping-provider'

export {
  MondialRelayProvider,
  mondialRelayProvider,
  resetMockShippingCounter,
} from './mondial-relay-provider'
export type { MondialRelayProviderDeps } from './mondial-relay-provider'
