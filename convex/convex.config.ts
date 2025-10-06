import migrations from '@convex-dev/migrations/convex.config'
import workpool from '@convex-dev/workpool/convex.config'
import { defineApp } from 'convex/server'

const app = defineApp()

app.use(workpool, { name: 'civitaiWorkpool' })
app.use(migrations)

export default app
