import cron from 'node-cron'
import { getDB } from '../database'
import { clearAgentConfigCache } from '../agents'

export const initCronJobs = () => {
  // Database cleanup — every Sunday at 3:00 AM
  cron.schedule('0 3 * * 0', async () => {
    console.log('[cron] Starting database cleanup...')
    try {
      const db = getDB()
      const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 86400
      const result = await db.run(
        'DELETE FROM messages WHERE timestamp < ?',
        [ninetyDaysAgo]
      )
      console.log(`[cron] Cleanup complete — deleted ${result.changes} old messages`)
    } catch (error) {
      console.error('[cron] Cleanup failed:', error)
    }
  })

  // Agent config cache refresh — every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    clearAgentConfigCache()
  })

  // Health check — every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      const db = getDB()
      await db.get('SELECT 1')
      console.log(`[cron] Health check passed at ${new Date().toISOString()}`)
    } catch (error) {
      console.error('[cron] Health check failed:', error)
    }
  })

  console.log('[cron] Scheduled tasks initialized')
}
