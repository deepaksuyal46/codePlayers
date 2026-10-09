import './env';
import mongoose from 'mongoose';
import {db} from '../src/lib/db';
import {indexes,Inventory,ProductModel,CatalogueReference} from '../src/lib/models';
import products from '../data/dataset-products.json';
import references from '../data/dataset-references.json';
import {validateProducts} from './catalogue-schema';
import {z} from 'zod';
async function main(){
 const rows=validateProducts(products);
 const refs=z.array(z.object({kind:z.enum(['category','seller','navigation']),sourceId:z.string().min(1),record:z.record(z.string(),z.string())})).parse(references);
 await db();await indexes();
 for(const p of rows){const {initialStock,...fields}=p;
  await ProductModel.updateOne({sku:p.sku},{$set:{...fields,active:true}},{upsert:true,runValidators:true});
  await Inventory.updateOne({sku:p.sku},{$setOnInsert:{sku:p.sku,available:initialStock,reserved:0,sold:0}},{upsert:true,runValidators:true});
 }
 for(const r of refs)await CatalogueReference.updateOne({kind:r.kind,sourceId:r.sourceId},{$set:r},{upsert:true});
 console.log(`Imported ${rows.length} sample products and ${refs.length} reference records. Existing stock, carts, and orders were preserved. Prior demo products are retained if already present.`);
}
main().catch(e=>{console.error('Dataset seed failed:',e.name,e.code||'Check validation, connection and permissions');process.exitCode=1;}).finally(()=>mongoose.disconnect());
