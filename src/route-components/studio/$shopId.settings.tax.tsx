import { useLoaderData } from '@tanstack/react-router'
import { ShopTaxReportPage } from '#/components/studio/ShopTaxReportPage'

export function ShopTaxReportRoute() {
  const { report } = useLoaderData({ from: '/studio/$shopId/settings/tax' })
  return <ShopTaxReportPage initialReport={report} />
}
