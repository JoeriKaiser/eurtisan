import { createFileRoute } from '@tanstack/react-router'
import { ShopTaxReportRoute } from '#/route-components/studio/$shopId.settings.tax'
import { getShopTaxReport } from '#/lib/tax-report'

export const Route = createFileRoute('/studio/$shopId/settings/tax')({
  loader: async ({ params }) => {
    const now = new Date()
    const report = await getShopTaxReport({
      data: { shopId: params.shopId, year: now.getFullYear() },
    })
    return { report }
  },
  component: ShopTaxReportRoute,
})
