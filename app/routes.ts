import type { RouteConfig } from '@react-router/dev/routes'
import { index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('images', 'routes/images.tsx'),
  route('images/:id', 'routes/images.$id.tsx'),
] satisfies RouteConfig
