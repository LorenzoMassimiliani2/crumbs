import { reactive, ref } from 'vue'

import type { TrendView } from '@/lib/stats'

/** Session-only trend state shared by the diary and the dedicated trend view. */
export const trendView = ref<TrendView>('day')
export const pendingTrendDate = ref<string | null>(null)

export type TrendChartType = 'bars' | 'line'

export interface TrendOptions {
  chart: TrendChartType
  showTarget: boolean
  showValues: boolean
}

export const trendOptions = reactive<TrendOptions>({
  chart: 'bars',
  showTarget: true,
  showValues: false,
})
