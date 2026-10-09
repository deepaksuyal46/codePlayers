import './env';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {db} from '../src/lib/db';
import {indexes,UserModel,CartModel,Limit} from '../src/lib/models';
import {OtpChallengeModel} from '../src/database/auth-models';
import {beginRegistration,beginLogin,completeOtp,resendOtp} from '../src/backend/otp-service';
const source=process.env.TEST_MONGODB_URI;
if(!source)throw new Error('Set TEST_MONGODB_URI to a test replica set. Normal MONGODB_URI is never selected automatically.');
const database='cp_otp_test_'+randomUUID().replaceAll('-','');const uri=new URL(source);uri.pathname='/'+database;
process.env.MONGODB_URI=uri.toString();process.env.MONGODB_DB_NAME=database;
process.env.TWOFACTOR_API_KEY='integration-test';process.env.OTP_SECRET='integration-only-secret-'.repeat(4);
const originalFetch=globalThis.fetch;let lastCode='';
globalThis.fetch=(async(url:any)=>{const parts=new URL(String(url)).pathname.split('/');lastCode=parts[parts.indexOf('SMS')+2];return new Response(JSON.stringify({Status:'Success',Details:'test'}));}) as typeof fetch;
async function reset(){await Promise.all([OtpChallengeModel.deleteMany({}),UserModel.deleteMany({}),CartModel.deleteMany({}),Limit.deleteMany({})]);}
const input={name:'OTP Test',email:'otp@example.test',password:'Testing12345!',phone:'9876543210'};
async function main(){await db();await indexes();
 let c=await beginRegistration(input);const code=lastCode;assert.equal(await UserModel.countDocuments(),0);assert.equal((await OtpChallengeModel.findById(c.challengeId)).passwordHash.startsWith('$2'),true);
 const outcomes=await Promise.allSettled([completeOtp(c.challengeId,code,'registration'),completeOtp(c.challengeId,code,'registration')]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(await UserModel.countDocuments(),1);assert.equal(await CartModel.countDocuments(),1);let user=await UserModel.findOne();assert.equal(user.role,'user');assert.equal(user.phoneVerified,true);assert.equal(user.emailVerified,false);await assert.rejects(()=>completeOtp(c.challengeId,code,'registration'));
 await reset();c=await beginRegistration(input);const right=lastCode;const wrong=right==='111111'?'222222':'111111';for(let i=0;i<5;i++)await assert.rejects(()=>completeOtp(c.challengeId,wrong,'registration'));await assert.rejects(()=>completeOtp(c.challengeId,right,'registration'));assert.equal(await UserModel.countDocuments(),0);
 await reset();c=await beginRegistration(input);await assert.rejects(()=>resendOtp(c.challengeId));await OtpChallengeModel.updateOne({_id:c.challengeId},{$set:{expiresAt:new Date(0)}});await assert.rejects(()=>completeOtp(c.challengeId,lastCode,'registration'));
 await reset();user=await UserModel.create({name:'Legacy',email:input.email,passwordHash:await bcrypt.hash(input.password,12)});await CartModel.create({userId:user._id,version:3,items:[]});const enrollment=await beginLogin({...input,portal:'user'});assert.equal(enrollment.status,'otp_required');if(!('challengeId' in enrollment))throw new Error('Expected OTP challenge');await completeOtp(enrollment.challengeId!,lastCode,'login');assert.equal((await CartModel.findOne({userId:user._id})).version,3);assert.equal((await UserModel.findById(user._id)).phoneVerified,true);
 await Limit.deleteMany({});await UserModel.updateOne({_id:user._id},{$set:{role:'admin'}});const login=await beginLogin({...input,portal:'admin'});assert.equal(login.status,'otp_required');if(!('challengeId' in login))throw new Error('Expected OTP challenge');const adminCode=lastCode;await UserModel.updateOne({_id:user._id},{$set:{role:'user'}});await assert.rejects(()=>completeOtp(login.challengeId!,adminCode,'login'));
 console.log('PASS: registration transaction, concurrent replay, attempt cap, expiry, resend cooldown, legacy phone enrollment and role-change rejection. Provider delivery and browser cookies were mocked/not exercised.');}
main().catch(e=>{console.error('Auth integration failed:',e.name,e.code||'See assertion');process.exitCode=1;}).finally(async()=>{globalThis.fetch=originalFetch;if(mongoose.connection.name===database)await mongoose.connection.dropDatabase();await mongoose.disconnect();});
