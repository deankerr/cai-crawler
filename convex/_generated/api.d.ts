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
import type * as civitai_query from "../civitai/query.js";
import type * as civitai_validators from "../civitai/validators.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as myFunctions from "../myFunctions.js";
import type * as run from "../run.js";
import type * as storage from "../storage.js";
import type * as utils_extractors from "../utils/extractors.js";
import type * as utils_url from "../utils/url.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "civitai/query": typeof civitai_query;
  "civitai/validators": typeof civitai_validators;
  http: typeof http;
  images: typeof images;
  myFunctions: typeof myFunctions;
  run: typeof run;
  storage: typeof storage;
  "utils/extractors": typeof utils_extractors;
  "utils/url": typeof utils_url;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
