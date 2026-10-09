import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {db} from '@/lib/db';
import {AppError,fail} from '@/lib/domain';
import {identity,endSession,rate,requireAdmin} from '@/lib/auth';
import {beginRegistration,beginLogin,confirmOtp,resendOtp,publicUser} from '@/backend/otp-service';
import {Attempt,CartModel,Inventory,OrderModel,ProductModel,UserModel} from '@/lib/models';
import {cartDTO,checkoutFor,orderDTO,payDemo,productDTO,quoteFor,release,reserve,updateCart} from '@/lib/commerce';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const address=z.object({name:z.string().trim().min(2).max(80),phone:z.string().regex(/^\d{10}$/,'Enter a 10-digit phone number'),line:z.string().trim().min(5).max(200),city:z.string().trim().min(2).max(80),pincode:z.string().regex(/^[1-9]\d{5}$/,'Enter a 6-digit Indian PIN code')});
const id=(value:string)=>{if(!/^[a-f0-9]{24}$/i.test(value))fail(400,'VALIDATION_ERROR','Invalid ID');return value;};
const skuSchema=z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
async function body(req:NextRequest){const raw=await req.text();if(raw.length>16000)fail(413,'TOO_LARGE','Request too large');try{return JSON.parse(raw);}catch{fail(400,'VALIDATION_ERROR','Invalid JSON');}}
async function dispatch(req:NextRequest,path:string[]) {
  const route=path.join('/'),method=req.method;
  if(!['GET','HEAD'].includes(method)) {
    if(process.env.NODE_ENV==='production'&&!process.env.APP_ORIGIN)fail(503,'CONFIGURATION_ERROR','APP_ORIGIN must be configured for this deployment');
    const expected=new URL(process.env.APP_ORIGIN||req.url).origin;
    if(req.headers.get('origin')!==expected)fail(403,'FORBIDDEN','Request origin is not allowed');
  }
  const mongo=await db();
  if(route==='health'&&method==='GET') {await mongo.connection.db!.admin().ping();return {status:'ready',database:'connected',paymentMode:'demo'};}
  if(route==='auth/me'&&method==='GET'){const u=await identity(false);return {user:u?publicUser(u):null};}
  if(route==='auth/register'&&method==='POST'){
    const input=z.object({name:z.string().trim().min(2).max(80),email:z.email().trim().toLowerCase().max(254),phone:z.string().min(10).max(20),password:z.string().min(10).max(64).refine(s=>Buffer.byteLength(s,'utf8')<=72)}).parse(await body(req));
    return beginRegistration(input);
  }
  if(route==='auth/login'&&method==='POST'){
    const input=z.object({email:z.email().trim().toLowerCase().max(254),password:z.string().min(1).max(64),phone:z.string().max(20).optional(),portal:z.enum(['user','admin']).default('user')}).parse(await body(req));
    return beginLogin(input);
  }
  if(['auth/verify-register','auth/verify-login'].includes(route)&&method==='POST'){
    const input=z.object({challengeId:z.uuid(),otp:z.string().regex(/^[0-9]{6}$/)}).parse(await body(req));
    return confirmOtp(input.challengeId,input.otp,route==='auth/verify-register'?'registration':'login');
  }
  if(route==='auth/resend-otp'&&method==='POST'){
    const input=z.object({challengeId:z.uuid()}).parse(await body(req));
    return resendOtp(input.challengeId);
  }
  if(route==='admin/stats'&&method==='GET'){
    await requireAdmin();
    return {products:await ProductModel.countDocuments(),users:await UserModel.countDocuments(),orders:await OrderModel.countDocuments()};
  }
  if(route.startsWith('admin/')){
    const admin=await requireAdmin();await rate('admin:'+String(admin._id),120);
    if(route==='admin/products'&&method==='GET'){
      const args=z.object({page:z.coerce.number().int().min(1).max(1000).default(1),q:z.string().max(100).default('')}).parse(Object.fromEntries(req.nextUrl.searchParams));
      const filter:any=args.q.trim()?{$text:{$search:args.q.trim()}}:{};
      const products=await ProductModel.find(filter).sort({_id:1}).skip((args.page-1)*12).limit(13);const hasMore=products.length>12;products.splice(12);
      const stocks=await Inventory.find({sku:{$in:products.map(p=>p.sku)}});
      return {items:products.map(p=>({...productDTO(p,stocks.find(s=>s.sku===p.sku)?.available||0),active:p.active})),hasMore};
    }
    if(path[1]==='products'&&path.length===3&&method==='PATCH'){
      const input=z.object({pricePaise:z.number().int().min(0).max(100000000),active:z.boolean()}).strict().parse(await body(req));
      const p=await ProductModel.findByIdAndUpdate(id(path[2]),{$set:input},{new:true,runValidators:true});if(!p)fail(404,'NOT_FOUND','Product not found');
      const stock=await Inventory.findOne({sku:p.sku});return {...productDTO(p,stock?.available||0),active:p.active};
    }
    if(route==='admin/orders'&&method==='GET')return {items:(await OrderModel.find().sort({createdAt:-1}).limit(50)).map(o=>({id:String(o._id),createdAt:o.createdAt,totalPaise:o.totalPaise,status:o.status}))};
    fail(404,'NOT_FOUND','Admin endpoint not found');
  }
  if(route==='auth/logout'&&method==='POST'){await endSession();return {ok:true};}
  if(route==='categories'&&method==='GET')return {items:await ProductModel.distinct('category',{active:true})};
  if(route==='products'&&method==='GET'){
    const p=req.nextUrl.searchParams;
    const query=z.object({q:z.string().max(100).default(''),category:z.string().max(80).default(''),maxPrice:z.coerce.number().int().min(0).max(100000000).default(100000000),page:z.coerce.number().int().min(1).max(1000).default(1),limit:z.coerce.number().int().min(1).max(24).default(12),sort:z.enum(['featured','price_asc','price_desc','name']).default('featured')}).parse(Object.fromEntries(p));
    const filter:any={active:true,pricePaise:{$lte:query.maxPrice}};
    if(query.category)filter.category=query.category;if(query.q.trim())filter.$text={$search:query.q.trim()};
    const sort:any=query.sort==='price_asc'?{pricePaise:1,_id:1}:query.sort==='price_desc'?{pricePaise:-1,_id:1}:query.sort==='name'?{title:1,_id:1}:{_id:1};
    const products=await ProductModel.find(filter).sort(sort).skip((query.page-1)*query.limit).limit(query.limit+1);
    const hasMore=products.length>query.limit;products.splice(query.limit);
    const stocks=await Inventory.find({sku:{$in:products.map(p=>p.sku)}});
    return {items:products.map(p=>productDTO(p,stocks.find(s=>s.sku===p.sku)?.available||0)),hasMore,page:query.page};
  }
  if(path[0]==='products'&&path.length===2&&method==='GET'){const p=await ProductModel.findOne({_id:id(path[1]),active:true});if(!p)fail(404,'NOT_FOUND','Product not found');const s=await Inventory.findOne({sku:p.sku});return productDTO(p,s?.available||0);}
  const user=await identity();const userId=String(user!._id);await rate('user:'+userId,180);
  if(route==='cart'&&method==='GET')return cartDTO(userId);
  if(path[0]==='cart'&&path[1]==='items'&&path.length===3&&(method==='PUT'||method==='DELETE')){
    const x=z.object({quantity:z.number().int().min(1).max(10).optional(),expectedVersion:z.number().int().min(0)}).parse(await body(req));
    if(method==='PUT'&&x.quantity===undefined)fail(400,'VALIDATION_ERROR','Quantity required');
    return updateCart(userId,skuSchema.parse(path[2]),method==='DELETE'?0:x.quantity!,x.expectedVersion);
  }
  if(route==='checkout/quote'&&method==='POST'){const x=z.object({address}).parse(await body(req));return quoteFor(userId,x.address);}
  if(route==='checkout'&&method==='POST'){
    await rate('checkout:'+userId,20);
    const x=z.object({cartVersion:z.number().int().min(0),quoteHash:z.string().length(64),address}).parse(await body(req));
    const key=z.string().min(10).max(100).regex(/^[a-zA-Z0-9_-]+$/).parse(req.headers.get('Idempotency-Key'));
    return reserve(userId,key,x);
  }
  if(path[0]==='checkout'&&path.length>=2){const checkoutId=id(path[1]);
    if(path.length===2&&method==='GET')return checkoutFor(userId,checkoutId);
    if(path.length===3&&path[2]==='cancel'&&method==='POST'){if(!await Attempt.exists({_id:checkoutId,userId}))fail(404,'NOT_FOUND','Checkout not found');await release(checkoutId,'CANCELLED');return checkoutFor(userId,checkoutId);}
    if(path.length===3&&path[2]==='payment'&&method==='POST'){const x=z.object({outcome:z.enum(['success','decline'])}).parse(await body(req));return payDemo(userId,checkoutId,x.outcome);}
  }
  if(route==='orders'&&method==='GET')return {items:(await OrderModel.find({userId}).sort({createdAt:-1}).limit(50)).map(orderDTO)};
  if(path[0]==='orders'&&path.length===2&&method==='GET'){const o=await OrderModel.findOne({_id:id(path[1]),userId});if(!o)fail(404,'NOT_FOUND','Order not found');return orderDTO(o);}
  fail(404,'NOT_FOUND','Endpoint not found');
}
async function handle(req:NextRequest,ctx:{params:Promise<{path:string[]}>}) {
  const requestId=randomUUID();try{return NextResponse.json({data:await dispatch(req,(await ctx.params).path),requestId},{headers:{'Cache-Control':'no-store'}});}
  catch(e:any){const validation=e instanceof z.ZodError;const status=e instanceof AppError?e.status:validation?400:503;
    if(status===503)console.error(JSON.stringify({requestId,errorType:e.name||'Error',code:e.code||'DEPENDENCY_FAILURE'}));
    return NextResponse.json({error:{code:e instanceof AppError?e.code:validation?'VALIDATION_ERROR':'DEPENDENCY_UNAVAILABLE',message:e instanceof AppError?e.message:validation?e.issues[0]?.message:'Service unavailable. Check database setup and server logs.'},requestId},{status,headers:{'Cache-Control':'no-store'}});
  }
}
export {handle as GET,handle as POST,handle as PUT,handle as DELETE,handle as PATCH};
