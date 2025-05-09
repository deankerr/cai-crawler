import { literals } from 'convex-helpers/validators'

export const vTimePeriod = literals('AllTime', 'Year', 'Month', 'Week', 'Day')
export const vSortOrder = literals('Most Reactions', 'Most Collected', 'Most Comments', 'Newest')
