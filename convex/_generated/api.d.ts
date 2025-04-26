/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as action_images from "../action/images.js";
import type * as action_models from "../action/models.js";
import type * as action_workflow from "../action/workflow.js";
import type * as civitai_query from "../civitai/query.js";
import type * as civitai_validators from "../civitai/validators.js";
import type * as mutations_images from "../mutations/images.js";
import type * as mutations_modelVersions from "../mutations/modelVersions.js";
import type * as mutations_models from "../mutations/models.js";
import type * as myFunctions from "../myFunctions.js";
import type * as run from "../run.js";
import type * as utils_api from "../utils/api.js";
import type * as utils_extractors from "../utils/extractors.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "action/images": typeof action_images;
  "action/models": typeof action_models;
  "action/workflow": typeof action_workflow;
  "civitai/query": typeof civitai_query;
  "civitai/validators": typeof civitai_validators;
  "mutations/images": typeof mutations_images;
  "mutations/modelVersions": typeof mutations_modelVersions;
  "mutations/models": typeof mutations_models;
  myFunctions: typeof myFunctions;
  run: typeof run;
  "utils/api": typeof utils_api;
  "utils/extractors": typeof utils_extractors;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
