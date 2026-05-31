import { describe, expect, it } from 'vitest'
import { checkoutFailuresTotal, getMetricsBody, ordersCreatedTotal } from './metrics.server'

describe('metrics.server', () => {
  it('exposes Prometheus text including business counters', async () => {
    ordersCreatedTotal.inc()
    checkoutFailuresTotal.inc({ reason: 'test' })

    const body = await getMetricsBody()
    expect(body).toContain('eurtisan_orders_created_total')
    expect(body).toContain('eurtisan_checkout_failures_total')
  })
})
