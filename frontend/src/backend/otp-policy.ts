import {createHmac,randomInt,timingSafeEqual} from 'node:crypto';
export const OTP_TTL_MS=5*60*1000;
export const OTP_MAX_ATTEMPTS=5;
export function normalizePhone(value:string){const digits=value.replace(/[ +()-]/g,'');const local=digits.startsWith('91')&&digits.length===12?digits.slice(2):digits;if(!/^[6-9][0-9]{9}$/.test(local))throw new Error('Enter a valid 10-digit Indian mobile number');return '91'+local;}
export function makeCode(){return String(randomInt(100000,1000000));}
export function otpDigest(id:string,code:string,secret:string){if(secret.length<32)throw new Error('OTP_SECRET must be at least 32 characters');return createHmac('sha256',secret).update(id+':'+code).digest('hex');}
export function matchesOtp(id:string,code:string,digest:string,secret:string){if(!/^[0-9]{6}$/.test(code)||!/^[a-f0-9]{64}$/.test(digest))return false;return timingSafeEqual(Buffer.from(otpDigest(id,code,secret),'hex'),Buffer.from(digest,'hex'));}
export function canVerify(c:{status:string;attempts:number;expiresAt:Date},now=new Date()){return c.status==='active'&&c.attempts<OTP_MAX_ATTEMPTS&&c.expiresAt>now;}
export function adminAllowed(user:{role?:string;phoneVerified?:boolean}|null,level?:string){return !!user&&user.role==='admin'&&user.phoneVerified===true&&level==='two_factor';}
