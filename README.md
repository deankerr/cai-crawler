# civitai-crawler

A crawler and cache for the [Civitai](https://civitai.com) API, built with [Convex](https://convex.dev), TypeScript, and Zod.

## What is this?

This project aims to provide a robust, queryable local cache of models, LoRAs, images, and metadata from Civitai. Civitai hosts a huge and ever-growing collection of generative AI models and assets, but their API can be slow or unreliable, and the data is subject to change at any time. Our crawler fetches, stores, and makes this data easily accessible for further analysis, search, and UI development.

## How does it work?

- **Convex** is used for all structured data storage, queries, and workflow orchestration.
- **Civitai API** is queried via Convex actions, with rate-limiting and queuing planned for reliability.
- **R2 (or similar object storage)** will be used for storing images and large assets (planned, not yet implemented).
- **Zod** is used for schema validation and parsing of API responses.
- The system is designed to be resilient to API changes and data anomalies, capturing raw data for later review.
- The architecture favors pure, composable functions and a fail-fast approach.

## Current Status

- Early proof-of-concept: basic crawling, model/image/version/creator extraction, and Convex storage are working.
- No frontend UI yet; focus is on backend robustness and data coverage.
- Asset (image) storage is stubbed and will be added soon.
- Query and mutation patterns are evolving as we learn more about Civitai's data.

## Roadmap / Plans

- Expand crawling coverage and robustness
- Add rate-limiting, queuing, and scheduled tasks
- Store images and assets in R2
- Build a frontend UI for querying and browsing cached data
- Support advanced search and analytics
- Adapt to new Civitai API features and data types as they emerge