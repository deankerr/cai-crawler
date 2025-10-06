import type { DataModel } from './_generated/dataModel'
import { Migrations } from '@convex-dev/migrations'
import { components } from './_generated/api'

export const migrations = new Migrations<DataModel>(components.migrations)
export const run = migrations.runner()
