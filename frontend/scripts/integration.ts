import bcrypt from 'bcryptjs';
import './env';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import {db} from '../src/lib/db';
import {indexes,Inventory,ProductModel,UserModel,CartModel,Attempt,Reservation,OrderModel,Payment,Outbox,Notification} from '../src/lib/models';
import {reserve,quoteFor,payDemo,release,expireBatch,drainOutbox} from '../src/lib/commerce';
const database='cp_test_'+randomUUID().replaceAll('-','');
const source=process.env.TEST_MONGODB_URI;
if(!source)throw new Error('Set TEST_MONGODB_URI to a transaction-capable TEST deployment, or use npm run test:local. Your normal MONGODB_URI is never selected automatically.');
const uri=new URL(source);uri.pathname='/'+database;process.env.MONGODB_URI=uri.toString();process.env.MONGODB_DB_NAME=database;
const address={name:'Demo Test',phone:'9999999999',line:'Demo Street 123',city:'Test City',pincode:'263139'};
const base='http://localhost:3210';let server:ReturnType<typeof spawn>|undefined;
async function call(path:string,method='GET',body?:unknown,cookie='',extra:Record<string,string>={}){const r=await fetch(base+'/api'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie,...extra},body:body===undefined?undefined:JSON.stringify(body)});return {r,j:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie};}
async function fixture(sku:string,qty=1){await ProductModel.create({sku,slug:sku,title:sku,category:'Tests',description:'Test fixture',pricePaise:10000,image:'/products/tote.svg',imageLite:'/products/tote-lite.svg',active:true,demo:true});await Inventory.create({sku,available:qty,reserved:0,sold:0});}
async function user(sku:string,quantity=1){const u=await UserModel.create({name:'Test',email:randomUUID()+'@example.test',passwordHash:'unused-service-test'});await CartModel.create({userId:u._id,version:0,items:[{sku,quantity}]});return String(u._id);}
async function attempt(uid:string,key=randomUUID()){const q=await quoteFor(uid,address);return reserve(uid,key,{cartVersion:q.cartVersion,quoteHash:q.quoteHash,address});}
async function main(){
 await db();await indexes();await fixture('RACE',1);const ids=[];for(let i=0;i<20;i++)ids.push(await user('RACE'));
 const results=await Promise.allSettled(ids.map(u=>attempt(u)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const stock=await Inventory.findOne({sku:'RACE'});assert.equal(stock.available,0);assert.equal(stock.reserved,1);console.log('PASS: 20 overlapping last-unit requests; exactly one reservation.');
 await fixture('IDEMP',5);const u=await user('IDEMP');const q=await quoteFor(u,address);const input={cartVersion:q.cartVersion,quoteHash:q.quoteHash,address};const key=randomUUID();const attempts=await Promise.all(Array.from({length:8},()=>reserve(u,key,input)));assert.equal(new Set(attempts.map(a=>a.id)).size,1);await assert.rejects(()=>reserve(u,key,{...input,address:{...address,city:'Different'}}));console.log('PASS: concurrent retry deduplication and conflicting key rejected.');
 const a=attempts[0];await Promise.all(Array.from({length:8},()=>payDemo(u,a.id,'success')));assert.equal(await OrderModel.countDocuments({checkoutId:a.id}),1);assert.equal(await Payment.countDocuments({checkoutId:a.id}),1);assert.equal((await Inventory.findOne({sku:'IDEMP'})).sold,1);await drainOutbox();await drainOutbox();assert.equal(await Notification.countDocuments(),1);console.log('PASS: duplicate demo payment creates one order and one durable notification.');
 await fixture('EXP',1);const eu=await user('EXP');const e=await attempt(eu);const past=new Date(Date.now()-1000);await Reservation.updateOne({checkoutId:e.id},{$set:{expiresAt:past}});await Attempt.updateOne({_id:e.id},{$set:{expiresAt:past}});await Promise.all([expireBatch(),expireBatch(),release(e.id,'CANCELLED')]);assert.equal((await Inventory.findOne({sku:'EXP'})).available,1);assert.equal((await Inventory.findOne({sku:'EXP'})).reserved,0);await assert.rejects(()=>payDemo(eu,e.id,'success'));console.log('PASS: expiry/cancel release exactly once; expired demo payment blocked.');
 await fixture('CANCEL',1);const cu=await user('CANCEL');const ca=await attempt(cu);await Promise.allSettled([payDemo(cu,ca.id,'success'),release(ca.id,'CANCELLED')]);const ci=await Inventory.findOne({sku:'CANCEL'});assert.equal(ci.reserved,0);assert.equal(ci.available+ci.sold,1);assert.equal(await OrderModel.countDocuments({checkoutId:ca.id}),ci.sold);console.log('PASS: confirmation/cancel race preserves stock and order consistency.');
 await fixture('ALL',1);await fixture('NONE',0);const mu=await user('ALL');await CartModel.updateOne({userId:mu},{$push:{items:{sku:'NONE',quantity:1}}});await assert.rejects(()=>attempt(mu));assert.equal((await Inventory.findOne({sku:'ALL'})).available,1);assert.equal(await Attempt.countDocuments({userId:mu}),0);console.log('PASS: multi-item unavailable line rolls back entire reservation.');
 await fixture('CHANGE',2);const pu=await user('CHANGE');const pq=await quoteFor(pu,address);await ProductModel.updateOne({sku:'CHANGE'},{$set:{pricePaise:20000}});await assert.rejects(()=>reserve(pu,randomUUID(),{cartVersion:pq.cartVersion,quoteHash:pq.quoteHash,address}));console.log('PASS: changed price requires new quote.');
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3210','--hostname','127.0.0.1'],{env:{...process.env,APP_ORIGIN:base,PAYMENT_MODE:'demo'},stdio:['ignore','pipe','pipe']});let log='';server.stdout?.on('data',d=>{log+=d;});server.stderr?.on('data',d=>{log+=d;});let ready=false;
 for(let i=0;i<90;i++){await new Promise(r=>setTimeout(r,500));try{if((await call('/health')).r.ok){ready=true;break;}}catch{}}
 if(!ready)throw new Error('Test app startup failed: '+log.slice(-3000));
 const email=randomUUID()+'@example.test';const apiUser=await UserModel.create({name:'API Test',email,passwordHash:await bcrypt.hash('Testing12345!',12),phone:'919876543210',phoneVerified:true,role:'user'});await CartModel.create({userId:apiUser._id,version:0,items:[]});
 const logged=await call('/auth/login','POST',{email,password:'Testing12345!',portal:'user'});assert.equal(logged.r.status,200);const cookie=logged.cookie;assert.ok(cookie.includes('cp_session='));assert.equal((await call('/auth/me','GET',undefined,cookie)).j.data.user.email,email);
 assert.equal((await call('/admin/stats','GET',undefined,cookie)).r.status,403);assert.equal((await call('/admin/products/'+String((await ProductModel.findOne())._id),'PATCH',{pricePaise:1,active:false},cookie)).r.status,403);
 assert.equal((await call('/cart')).r.status,401);const cart=(await call('/cart','GET',undefined,cookie)).j.data;
 assert.equal((await call('/cart/items/IDEMP','PUT',{quantity:1,expectedVersion:cart.version},cookie)).r.status,200);
 assert.equal((await call('/cart/items/IDEMP','PUT',{quantity:2,expectedVersion:cart.version},cookie)).r.status,409);
 assert.equal((await call('/cart/items/IDEMP','PUT',{quantity:1,expectedVersion:1},cookie,{Origin:'https://evil.example'})).r.status,403);
 assert.equal((await call('/orders/'+String((await OrderModel.findOne({checkoutId:a.id}))._id),'GET',undefined,cookie)).r.status,404);
 assert.equal((await call('/products?sort=invalid')).r.status,400);assert.equal((await call('/products')).r.status,200);
 await call('/auth/logout','POST',{},cookie);assert.equal((await call('/cart','GET',undefined,cookie)).r.status,401);
 console.log('PASS: HTTP verified-customer login/session/logout, admin denial, cart versioning, origin rejection, private-order ownership, catalogue validation.');
 console.log('ALL INTEGRATION CHECKS PASSED. Test database: '+database);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server){server.kill('SIGTERM');await new Promise(r=>setTimeout(r,1000));}if(mongoose.connection.name===database)await mongoose.connection.dropDatabase();await mongoose.disconnect();});
