import workpool from '@convex-dev/workpool/convex.config'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(workpool, { name: 'civitaiWorkpool' })
export default app
