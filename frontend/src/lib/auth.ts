import {adminAllowed} from '../backend/otp-policy';
import {randomBytes,createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {Session,UserModel,Limit} from './models';
import {db} from './db';
import {fail} from './domain';
export const COOKIE='cp_session';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function identity(required=true) {
  await db(); const token=(await cookies()).get(COOKIE)?.value;
  const session=token?await Session.findOne({tokenHash:hash(token),expiresAt:{$gt:new Date()}}):null;
  const user=session?await UserModel.findById(session.userId):null;
  if(user&&(!user.phoneVerified||(user.role==='admin'&&!adminAllowed(user,session?.authLevel)))){if(required)fail(401,'VERIFICATION_REQUIRED','Sign in again to verify your phone');return null;}
  if(!user&&required) fail(401,'UNAUTHENTICATED','Please sign in to continue');
  return user;
}
export async function startSession(userId:string,authLevel:'password'|'two_factor'='password') {
  const jar=await cookies(); const old=jar.get(COOKIE)?.value;
  if(old)await Session.deleteOne({tokenHash:hash(old)});
  const token=randomBytes(32).toString('hex');const expires=new Date(Date.now()+7*86400000);
  await Session.create({userId,tokenHash:hash(token),expiresAt:expires,authLevel});
  jar.set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',expires});
}
export async function endSession() { const jar=await cookies(); const t=jar.get(COOKIE)?.value;if(t)await Session.deleteOne({tokenHash:hash(t)});jar.delete(COOKIE); }
export async function rate(scope:string,max:number,seconds=60) {
  const bucket=Math.floor(Date.now()/(seconds*1000));const id=hash(scope)+':'+bucket;
  let row;
  try {row=await Limit.findOneAndUpdate({_id:id},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((bucket+2)*seconds*1000)}},{upsert:true,new:true});}
  catch(e:any){if(e.code!==11000)throw e;row=await Limit.findOneAndUpdate({_id:id},{$inc:{count:1}},{new:true});}
  if(!row||row.count>max)fail(429,'RATE_LIMITED','Too many attempts. Please wait a minute.');
}

export async function requireAdmin() {
 await db();
 const token=(await cookies()).get(COOKIE)?.value;
 const session=token?await Session.findOne({tokenHash:hash(token),expiresAt:{$gt:new Date()}}):null;
 const user=session?await UserModel.findById(session.userId):null;
 if(!adminAllowed(user,session?.authLevel))
   fail(403,'FORBIDDEN','An admin session with two-factor verification is required');
 return user;
}
