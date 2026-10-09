import './env';
import {readFile,stat} from 'node:fs/promises';
import mongoose from 'mongoose';
import {z} from 'zod';
import {db} from '../src/lib/db';
import {indexes,Inventory,ProductModel} from '../src/lib/models';
import {validateProducts} from './catalogue-schema';
async function main(){const file=process.argv[2];if(!file)throw new Error('Usage: npm run import -- path/to/normalized.json');if((await stat(file)).size>10*1024*1024)throw new Error('Maximum normalized file size: 10 MB');const rows=validateProducts(JSON.parse(await readFile(file,'utf8')));await db();await indexes();let count=0;for(const r of rows){const {initialStock,...p}=r;await ProductModel.updateOne({sku:p.sku},{$set:{...p,imageLite:p.imageLite||p.image,active:true}},{upsert:true});await Inventory.updateOne({sku:p.sku},{$setOnInsert:{sku:p.sku,available:initialStock,reserved:0,sold:0}},{upsert:true});count++;}console.log('Catalogue rows applied:',count,'Existing inventory preserved.');}
main().catch(e=>{console.error(e instanceof z.ZodError?e.issues:e.name+': '+(e.code||e.message));process.exitCode=1;}).finally(()=>mongoose.disconnect());
