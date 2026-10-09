import {test} from 'node:test';
import assert from 'node:assert/strict';
import products from '../data/dataset-products.json';
import refs from '../data/dataset-references.json';
import {validateProducts} from '../scripts/catalogue-schema';
test('all 1000 source products validate with unique stable IDs',()=>{assert.equal(validateProducts(products).length,1000);assert.equal(new Set(products.map(p=>p.category)).size,12);assert.throws(()=>validateProducts([products[0],products[0]]));});
test('source prices are rupees converted to paise and stock is explicit demo policy',()=>{for(const p of products){assert.equal(p.pricePaise,Number(p.sourceRecord.discounted_price)*100);assert.equal(p.initialStock,({'In Stock':20,'Limited Stock':3,'Out of Stock':0} as Record<string,number>)[p.sourceRecord.availability]);assert.equal(p.demo,true);assert.equal(p.sku,p.sourceRecord.product_id);assert.equal(p.catalogue.reviewCount,Number(p.sourceRecord.review_count));}assert.equal(products.filter(p=>p.initialStock===0).length,310);});
test('all supporting CSV records retained without fabricated seller joins',()=>{assert.equal(refs.filter(r=>r.kind==='category').length,51);assert.equal(refs.filter(r=>r.kind==='seller').length,200);assert.equal(refs.filter(r=>r.kind==='navigation').length,9);const sellers=refs.filter(r=>r.kind==='seller');for(const p of products){const seller=sellers.find(s=>s.record.name===p.catalogue.sellerName);assert.equal(p.catalogue.sellerLocation,seller?.record.location??null);}});
