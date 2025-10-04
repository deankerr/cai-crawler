import type { Route } from './+types/home'
import { redirect } from 'react-router'

// eslint-disable-next-line no-empty-pattern
export function loader({}: Route.LoaderArgs) {
  return redirect('/images')
}

export default function Home() {
  return null
}
