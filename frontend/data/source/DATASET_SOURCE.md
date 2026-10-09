# Bundled demo dataset

These files were taken from the supplied `meesho_dataset-main.zip` archive, specifically its `cs_files/` directory:

- `products.csv` — product catalog used by `npm run import:products`
- `categories.csv` — category metadata for future catalog extensions
- `sellers.csv` — sample seller metadata for future extensions
- `navigation.csv` — sample navigation metadata for future extensions

The archive's `DATASET_SUMMARY.md` states that this is generated sample data intended to mimic Meesho's structure, not an official live Meesho export. Product image/product URLs are from the source dataset and may be unavailable or change.

The product importer only imports `products.csv` into the app's current `Product` collection. For this MVP, product records are linked to one internal dataset-import seller account because the app's current data model requires each product to reference an authenticated `User`. The separate `sellers.csv` is included as source data but is not yet modeled as a separate seller collection.

The dataset does not contain authoritative live inventory. `DATASET_DEFAULT_STOCK` is demo inventory only and must not be treated as real stock for live commerce.
