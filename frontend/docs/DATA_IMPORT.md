# Integrated dataset

Source: `backend/data/` in the uploaded `meesho-scalable-ecommerce-final.zip`. Original CSV bytes and original DATASET_SOURCE.md are preserved in `data/source/`. The source note says these records are generated samples, not a live official Meesho export. Its description of the old Express importer is historical; this document describes the delivered Next.js importer.

## Run in your existing web folder

```powershell
npm ci
npm run data:check
npm run db:check
npm run seed
npm run dev
```

Keep `npm run worker` running in a second terminal for reservation expiry. Seed requires your private MONGODB_URI in `.env.local`. Python is NOT required for initial setup: normalized JSON is bundled.

## Exact mapping

| CSV field | App field / behavior |
|---|---|
| product_id | Stable SKU; lowercase, underscore-to-hyphen slug |
| title, category, description | Searchable product fields |
| discounted_price | INR rupees converted to integer pricePaise; used by checkout |
| original_price | catalogue.originalPricePaise; retained metadata |
| image_url | Normal-mode photo; local placeholder on load error |
| availability | Initial demo inventory: In Stock=20, Limited Stock=3, Out of Stock=0 |
| brand, subcategory, material, sizes_available | Product detail metadata; sizes are descriptive, not selectable SKU variants |
| rating, review_count | Clearly labeled sample rating/count, no invented review text |
| seller_name | Sample seller label; location joined only on exact sellers.csv name match |
| delivery_time, return_policy | Source sample labels; no actual delivery or returns service |
| All original columns | sourceRecord retained in MongoDB, not returned wholesale to clients |

All 1,000 products are imported, including 310 initially out-of-stock entries. There are 12 distinct product categories. All 51 category, 200 seller, and 9 navigation rows are imported into CPCatalogueReference with a unique (kind, sourceId) index. They are reference data, not authenticated sellers or public navigation links. The storefront derives category filters from actual active products so unrelated source categories do not create empty filters.

790 product rows have no seller-name match in sellers.csv. Their location remains null; no seller account or fabricated relationship is created. Category hierarchy inconsistencies and potentially unavailable external URLs remain in the original records. See `data/dataset-report.json` for counts and original CSV SHA-256 checksums.

## Repeat imports and previous data

Seed validates every normalized product before database writes, upserts by SKU, refreshes catalogue fields, and initializes stock only for a new inventory record. It never resets available/reserved/sold counters, removes orders, or deletes prior products. If the earlier 12 demo products were already seeded they remain visible; a fresh app database contains exactly the 1,000 dataset products. Stock status shown in the app is current demo inventory, not the historical CSV availability string. Import is rerunnable after partial failure; the whole catalogue import is not one transaction.

## Updating the source files later

Replace the corresponding CSV files in data/source, then run:

```powershell
py -3 scripts/normalize-dataset.py
npm run data:check
npm run seed
```

The Python converter uses only the standard library. Tests assert the counts and mapping of THIS delivered dataset; intentionally changing the dataset requires updating those fixture expectations. `npm run import -- path/to/normalized.json` remains available for alternative normalized product data and uses the same validation schema, but imports no reference records. Exact schema: scripts/catalogue-schema.ts.

## Images and Lite Mode

Normal mode attempts source HTTPS photos; failed photos use a local SVG placeholder. Lite Mode loads only local placeholders for dataset products and requests six instead of twelve products per page. It does not pretend to have downloaded or verified photos, nor generate fake product-specific pictures. Supporting external navigation URLs are not used to send users away from this app.
