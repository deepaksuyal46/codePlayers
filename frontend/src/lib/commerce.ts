import mongoose,{type ClientSession} from 'mongoose';
import {Attempt,CartModel,Inventory,Notification,OrderModel,Outbox,Payment,ProductModel,Reservation} from './models';
import {db} from './db';
import {fail,fingerprint,RESERVATION_MS,total} from './domain';
import type {Address,Quote} from './types';
export function productDTO(p:any,available=0) {return {id:String(p._id),slug:p.slug,title:p.title,description:p.description,category:p.category,pricePaise:p.pricePaise,image:p.image,imageLite:p.imageLite||p.image,color:p.color,sku:p.sku,available,demo:!!p.demo,catalogue:p.catalogue};}
export function checkoutDTO(a:any) {return {id:String(a._id),status:a.status,expiresAt:a.expiresAt.toISOString(),serverTime:new Date().toISOString(),orderId:a.orderId?String(a.orderId):null,quote:a.quote,address:a.address};}
export function orderDTO(o:any) {return {id:String(o._id),checkoutId:String(o.checkoutId),lines:o.lines,totalPaise:o.totalPaise,createdAt:o.createdAt.toISOString(),address:o.address,status:o.status,paymentMode:o.paymentMode};}
export async function getCart(userId:string) {
  let cart=await CartModel.findOne({userId});
  if(!cart) { try{cart=await CartModel.create({userId,version:0,items:[]});}catch(e:any){if(e.code!==11000)throw e;cart=await CartModel.findOne({userId});} }
  return cart!;
}
export async function cartDTO(userId:string) {
  const c=await getCart(userId);const skus=c.items.map((x:any)=>x.sku);
  const products=await ProductModel.find({sku:{$in:skus},active:true});const stocks=await Inventory.find({sku:{$in:skus}});
  return {version:c.version,items:c.items.map((i:any)=>{const p=products.find(p=>p.sku===i.sku);return {sku:i.sku,quantity:i.quantity,product:p?productDTO(p,stocks.find(s=>s.sku===i.sku)?.available||0):null};})};
}
export async function updateCart(userId:string,sku:string,quantity:number,version:number) {
  const c=await getCart(userId);
  if(c.version!==version)fail(409,'CART_VERSION_CONFLICT','Your cart changed. Reload it and try again.');
  if(quantity>0&&!await ProductModel.exists({sku,active:true}))fail(404,'NOT_FOUND','Product unavailable');
  const items=c.items.filter((i:any)=>i.sku!==sku).map((i:any)=>({sku:i.sku,quantity:i.quantity}));
  if(quantity)items.push({sku,quantity});if(items.length>30)fail(400,'VALIDATION_ERROR','Cart limit is 30 products');
  const changed=await CartModel.updateOne({_id:c._id,version},{$set:{items},$inc:{version:1}});
  if(!changed.modifiedCount)fail(409,'CART_VERSION_CONFLICT','Your cart changed. Reload it and try again.');
  return cartDTO(userId);
}
export async function quoteFor(userId:string,address:Address,session?:ClientSession):Promise<Quote> {
  const c=await CartModel.findOne({userId}).session(session||null);
  if(!c||!c.items.length)fail(400,'EMPTY_CART','Your cart is empty');
  const lines=[];
  for(const item of [...c.items].sort((a:any,b:any)=>a.sku.localeCompare(b.sku))) {
    const p=await ProductModel.findOne({sku:item.sku,active:true}).session(session||null);
    if(!p)fail(409,'PRODUCT_UNAVAILABLE','A product in your cart is unavailable');
    lines.push({sku:p.sku,title:p.title,quantity:item.quantity,unitPricePaise:p.pricePaise,image:p.image});
  }
  const subtotalPaise=total(lines);const q={lines,subtotalPaise,shippingPaise:0,totalPaise:subtotalPaise,currency:'INR' as const,cartVersion:c.version};
  return {...q,quoteHash:fingerprint({q,address})};
}
export async function reserve(userId:string,key:string,input:{cartVersion:number;quoteHash:string;address:Address}) {
  await db();const requestHash=fingerprint(input);
  const previous=await Attempt.findOne({userId,key});
  if(previous){if(previous.requestHash!==requestHash)fail(409,'IDEMPOTENCY_CONFLICT','Checkout key was used with different details');return checkoutDTO(previous);}
  let result:any;
  try {
    await mongoose.connection.transaction(async session=>{
      const old=await Attempt.findOne({userId,key}).session(session);
      if(old){if(old.requestHash!==requestHash)fail(409,'IDEMPOTENCY_CONFLICT','Checkout details differ');result=old;return;}
      const q=await quoteFor(userId,input.address,session);
      if(q.cartVersion!==input.cartVersion||q.quoteHash!==input.quoteHash)fail(409,'QUOTE_CHANGED','Your cart or price changed. Review the total again.');
      // Touch cart as a version guard so concurrent cart edits conflict/retry.
      const c=await CartModel.findOneAndUpdate({userId,version:q.cartVersion},{$inc:{version:1}},{new:true,session});
      if(!c)fail(409,'CART_VERSION_CONFLICT','Cart changed');
      for(const l of q.lines) {
        const r=await Inventory.updateOne({sku:l.sku,available:{$gte:l.quantity}},{$inc:{available:-l.quantity,reserved:l.quantity}},{session});
        if(!r.modifiedCount)fail(409,'OUT_OF_STOCK',`${l.title} has insufficient stock`);
      }
      const expiresAt=new Date(Date.now()+RESERVATION_MS);
      const [a]=await Attempt.create([{userId,key,requestHash,status:'RESERVED',expiresAt,quote:q,address:input.address,cartSnapshot:{version:c.version,items:c.items}}],{session});
      await Reservation.create([{checkoutId:a._id,userId,status:'HELD',expiresAt,items:q.lines.map(l=>({sku:l.sku,quantity:l.quantity}))}],{session});
      result=a;
    });
  }catch(e:any){if(e.code!==11000)throw e;const a=await Attempt.findOne({userId,key});if(!a)throw e;if(a.requestHash!==requestHash)fail(409,'IDEMPOTENCY_CONFLICT','Checkout details differ');result=a;}
  return checkoutDTO(result);
}
export async function release(checkoutId:string,reason:'EXPIRED'|'CANCELLED'|'FAILED') {
  await db(); await mongoose.connection.transaction(async session=>{
    const match:any={checkoutId,status:'HELD'};if(reason==='EXPIRED')match.expiresAt={$lte:new Date()};
    const r=await Reservation.findOneAndUpdate(match,{$set:{status:reason==='EXPIRED'?'EXPIRED':'RELEASED'}},{new:true,session});
    if(!r)return;
    for(const l of r.items) {
      const changed=await Inventory.updateOne({sku:l.sku,reserved:{$gte:l.quantity}},{$inc:{reserved:-l.quantity,available:l.quantity}},{session});
      if(!changed.modifiedCount)throw new Error('Inventory invariant violation');
    }
    await Attempt.updateOne({_id:checkoutId,status:'RESERVED'},{$set:{status:reason}},{session});
    if(reason==='FAILED')await Payment.updateOne({checkoutId},{$setOnInsert:{checkoutId,mode:'demo',status:'FAILED',amountPaise:0}},{session,upsert:true});
  });
}
export async function expireBatch(limit=50) {
  await db();const holds=await Reservation.find({status:'HELD',expiresAt:{$lte:new Date()}}).limit(limit);
  for(const h of holds)await release(String(h.checkoutId),'EXPIRED');return holds.length;
}
export async function checkoutFor(userId:string,id:string) {
  const a=await Attempt.findOne({_id:id,userId});if(!a)fail(404,'NOT_FOUND','Checkout not found');
  if(a.status==='RESERVED'&&a.expiresAt.getTime()<=Date.now())await release(id,'EXPIRED');
  return checkoutDTO(await Attempt.findById(id));
}
export async function payDemo(userId:string,id:string,outcome:'success'|'decline') {
  if((process.env.PAYMENT_MODE||'demo')!=='demo')fail(503,'PAYMENT_UNAVAILABLE','Only demo payment is implemented');
  const state=await checkoutFor(userId,id);
  if(state.status==='CONFIRMED')return state;
  if(state.status!=='RESERVED')fail(409,'RESERVATION_EXPIRED','This checkout is no longer active');
  if(outcome==='decline'){await release(id,'FAILED');return checkoutFor(userId,id);}
  await mongoose.connection.transaction(async session=>{
    const a=await Attempt.findOne({_id:id,userId}).session(session);
    if(a?.status==='CONFIRMED')return;
    if(!a||a.status!=='RESERVED')fail(409,'INVALID_STATE','Checkout is no longer active');
    const r=await Reservation.findOneAndUpdate({checkoutId:id,status:'HELD',expiresAt:{$gt:new Date()}},{$set:{status:'COMMITTED'}},{new:true,session});
    if(!r)fail(409,'RESERVATION_EXPIRED','Your reservation expired. Return to your cart.');
    for(const l of r.items){const changed=await Inventory.updateOne({sku:l.sku,reserved:{$gte:l.quantity}},{$inc:{reserved:-l.quantity,sold:l.quantity}},{session});if(!changed.modifiedCount)throw new Error('Inventory invariant violation');}
    await Payment.create([{checkoutId:id,mode:'demo',status:'SUCCEEDED',amountPaise:a.quote.totalPaise}],{session});
    const [o]=await OrderModel.create([{checkoutId:id,userId,lines:a.quote.lines,totalPaise:a.quote.totalPaise,address:a.address,status:'CONFIRMED',paymentMode:'demo'}],{session});
    await Attempt.updateOne({_id:id,status:'RESERVED'},{$set:{status:'CONFIRMED',orderId:o._id}},{session});
    // Clear only if cart is precisely the reserved version. Preserve newer edits.
    await CartModel.updateOne({userId,version:a.cartSnapshot.version},{$set:{items:[]},$inc:{version:1}},{session});
    await Outbox.create([{eventId:'order:'+o._id,type:'ORDER_CONFIRMED',payload:{userId,orderId:String(o._id)},status:'PENDING',nextAttemptAt:new Date(),leasedUntil:new Date(0)}],{session});
  });
  return checkoutFor(userId,id);
}
export async function drainOutbox(limit=20) {
  for(let i=0;i<limit;i++){
    const now=new Date();const event=await Outbox.findOneAndUpdate({nextAttemptAt:{$lte:now},$or:[{status:'PENDING'},{status:'PROCESSING',leasedUntil:{$lte:now}}]},{$set:{status:'PROCESSING',leasedUntil:new Date(Date.now()+30000)},$inc:{attempts:1}},{new:true});
    if(!event)break;
    try{await Notification.updateOne({eventId:event.eventId},{$setOnInsert:{userId:event.payload.userId,message:`Demo order ${event.payload.orderId} confirmed`}},{upsert:true});await Outbox.updateOne({_id:event._id},{$set:{status:'DONE'}});}
    catch {await Outbox.updateOne({_id:event._id},{$set:{status:'PENDING',nextAttemptAt:new Date(Date.now()+Math.min(60000,1000*2**Math.min(event.attempts,6)))}});}
  }
}
