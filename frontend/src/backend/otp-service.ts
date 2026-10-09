import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {db} from '../lib/db';
import {fail} from '../lib/domain';
import {rate,startSession} from '../lib/auth';
import {CartModel,UserModel} from '../lib/models';
import {OtpChallengeModel} from '../database/auth-models';
import {sendPhoneOtp,otpConfig} from './twofactor';
import {OTP_TTL_MS,OTP_MAX_ATTEMPTS,makeCode,otpDigest,matchesOtp,normalizePhone} from './otp-policy';
export const publicUser=(u:any)=>({id:String(u._id),name:u.name,email:u.email,role:u.role??'user',phoneVerified:u.phoneVerified===true});
function phoneValue(value:string){try{return normalizePhone(value);}catch{fail(400,'INVALID_PHONE','Enter a valid 10-digit Indian mobile number');}}
async function sendLimits(email:string,phone:string){
 await rate('otp-global-hour',100,3600);await rate('otp-phone:'+phone,5,3600);await rate('otp-email:'+email,5,3600);
 await rate('otp-cooldown:'+phone,1,60);
}
async function issue(fields:Record<string,unknown> & {email:string;phone:string}){
 const {secret}=otpConfig();await sendLimits(fields.email,fields.phone);
 const id=randomUUID(),code=makeCode();const now=Date.now();
 await OtpChallengeModel.create({...fields,_id:id,codeDigest:otpDigest(id,code,secret),status:'sending',attempts:0,expiresAt:new Date(now+OTP_TTL_MS),resendAfter:new Date(now+60000)});
 try{await sendPhoneOtp(fields.phone,code);await OtpChallengeModel.updateOne({_id:id,status:'sending'},{$set:{status:'active'}});}
 catch(e){await OtpChallengeModel.deleteOne({_id:id});throw e;}
 return {status:'otp_required',challengeId:id,expiresAt:new Date(now+OTP_TTL_MS).toISOString(),resendAfter:new Date(now+60000).toISOString(),maskedPhone:'******'+fields.phone.slice(-4)};
}
export async function beginRegistration(input:{name:string;email:string;password:string;phone:string}){
 await db();otpConfig();await rate('register-hash-global',30);await rate('register:'+input.email,5,3600);
 const phone=phoneValue(input.phone);
 if(await UserModel.exists({$or:[{email:input.email},{phone}]}))fail(409,'ACCOUNT_EXISTS','Email or phone is already registered. Sign in instead.');
 return issue({name:input.name,email:input.email,phone,passwordHash:await bcrypt.hash(input.password,12),purpose:'registration',roleSnapshot:'user'});
}
export async function beginLogin(input:{email:string;password:string;portal:'user'|'admin';phone?:string}){
 await db();await rate('login-global',100);await rate('login:'+input.email,8,600);
 const u=await UserModel.findOne({email:input.email});
 if(!u||!await bcrypt.compare(input.password,u.passwordHash))fail(401,'INVALID_CREDENTIALS','Email or password is incorrect');
 if((u.role??'user')!==input.portal)fail(403,'WRONG_PORTAL','Use the login tab matching your account role.');
 if(!u.phoneVerified){
  if(!input.phone)fail(400,'PHONE_REQUIRED','Enter your mobile number to verify your existing account.');
  const phone=phoneValue(input.phone);
  if(await UserModel.exists({phone,_id:{$ne:u._id}}))fail(409,'PHONE_EXISTS','This phone is already registered.');
  return issue({email:u.email,phone,userId:u._id,purpose:'enrollment',roleSnapshot:u.role??'user'});
 }
 if(u.role==='admin'||u.twoFactorEnabled)return issue({email:u.email,phone:u.phone,userId:u._id,purpose:'login',roleSnapshot:u.role??'user'});
 await startSession(String(u._id),'password');return {status:'authenticated',user:publicUser(u)};
}
export async function completeOtp(challengeId:string,code:string,purpose:'registration'|'login'){
 await db();const {secret}=otpConfig();await rate('verify-global',300);await rate('verify:'+challengeId,8,300);
 const allowed=purpose==='registration'?['registration']:['login','enrollment'];
 const c=await OtpChallengeModel.findOneAndUpdate({_id:challengeId,purpose:{$in:allowed},status:'active',expiresAt:{$gt:new Date()},attempts:{$lt:OTP_MAX_ATTEMPTS}},{$inc:{attempts:1},$set:{status:'verifying'}},{new:true});
 if(!c)fail(400,'INVALID_OTP','Code expired, already used, busy, or maximum attempts reached.');
 if(!matchesOtp(c._id,code,c.codeDigest,secret)){
  await OtpChallengeModel.updateOne({_id:c._id,status:'verifying'},{$set:{status:c.attempts>=OTP_MAX_ATTEMPTS?'locked':'active'}});
  fail(400,'INVALID_OTP','Incorrect verification code.');
 }
 let user:any;
 try{
  await mongoose.connection.transaction(async session=>{
   const consumed=await OtpChallengeModel.updateOne({_id:c._id,status:'verifying',expiresAt:{$gt:new Date()}},{$set:{status:'consumed'}},{session});
   if(consumed.modifiedCount!==1)fail(400,'EXPIRED','Verification expired. Start again.');
   if(c.purpose==='registration'){
    [user]=await UserModel.create([{name:c.name,email:c.email,passwordHash:c.passwordHash,phone:c.phone,phoneVerified:true,role:'user',emailVerified:false}],{session});
    await CartModel.create([{userId:user._id,version:0,items:[]}],{session});
   }else{
    user=await UserModel.findOne({_id:c.userId,role:c.roleSnapshot}).session(session);
    // Legacy accounts may have no stored role; never allow a changed role through.
    if(!user&&c.roleSnapshot==='user')user=await UserModel.findOne({_id:c.userId,role:{$exists:false}}).session(session);
    if(!user)fail(403,'ACCOUNT_CHANGED','Account changed. Sign in again.');
    if(c.purpose==='enrollment'){
     if(user.phoneVerified)fail(409,'ACCOUNT_CHANGED','Phone already verified. Sign in again.');
     user.phone=c.phone;user.phoneVerified=true;await user.save({session});
    }else if(!user.phoneVerified||user.phone!==c.phone)fail(403,'ACCOUNT_CHANGED','Phone changed. Sign in again.');
    await CartModel.updateOne({userId:user._id},{$setOnInsert:{version:0,items:[]}},{upsert:true,session});
   }
  });
 }catch(e:any){
  await OtpChallengeModel.updateOne({_id:c._id,status:'verifying'},{$set:{status:'locked'}});
  if(e.code===11000)fail(409,'ACCOUNT_EXISTS','Email or phone is already registered. Sign in instead.');throw e;
 }
 return user;
}
export async function confirmOtp(challengeId:string,code:string,purpose:'registration'|'login'){
 const user=await completeOtp(challengeId,code,purpose);
 await startSession(String(user._id),'two_factor');
 return {status:'authenticated',user:publicUser(user)};
}
export async function resendOtp(id:string){
 await db();const {secret}=otpConfig();
 const current=await OtpChallengeModel.findOne({_id:id,status:'active',expiresAt:{$gt:new Date()},attempts:{$lt:OTP_MAX_ATTEMPTS}});
 if(!current)fail(400,'EXPIRED','Verification expired. Start again.');
 if(current.resendAfter>new Date())fail(429,'RATE_LIMITED','Wait 60 seconds before resending.');
 await sendLimits(current.email,current.phone);
 const code=makeCode();const c=await OtpChallengeModel.findOneAndUpdate({_id:id,status:'active',resendAfter:{$lte:new Date()},expiresAt:{$gt:new Date()},attempts:{$lt:OTP_MAX_ATTEMPTS}},{$set:{status:'sending',codeDigest:otpDigest(id,code,secret),resendAfter:new Date(Date.now()+60000)}},{new:true});
 if(!c)fail(409,'BUSY','Verification is already in progress.');
 try{await sendPhoneOtp(c.phone,code);await OtpChallengeModel.updateOne({_id:id,status:'sending'},{$set:{status:'active'}});}
 catch(e){await OtpChallengeModel.updateOne({_id:id},{$set:{status:'locked'}});throw e;}
 return {status:'otp_required',challengeId:id,expiresAt:c.expiresAt.toISOString(),resendAfter:c.resendAfter.toISOString(),maskedPhone:'******'+c.phone.slice(-4)};
}
