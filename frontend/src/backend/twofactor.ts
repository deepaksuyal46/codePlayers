// Server-side adapter. Never import this module from client components.
import {fail} from '../lib/domain';
export function otpConfig(){
 const key=process.env.TWOFACTOR_API_KEY?.trim();const secret=process.env.OTP_SECRET;
 if(!key||key.startsWith('REPLACE_')||!secret||secret.startsWith('REPLACE_')||secret.length<32)fail(503,'OTP_NOT_CONFIGURED','Phone verification is not configured. Contact the site administrator.');
 return {key,secret};
}
export async function sendPhoneOtp(phone:string,code:string,fetcher:typeof fetch=fetch){
 const {key}=otpConfig();
 const template=process.env.TWOFACTOR_TEMPLATE?.trim();
 const parts=[key,'SMS',phone,code];if(template)parts.push(template);
 const url='https://2factor.in/API/V1/'+parts.map(encodeURIComponent).join('/');
 try{
  const res=await fetcher(url,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  const body=await res.json();
  if(!res.ok||body.Status!=='Success')fail(503,'OTP_SEND_FAILED','Could not send a verification code. Check provider configuration or try again later.');
 }catch{fail(503,'OTP_SEND_FAILED','Could not send a verification code. Check provider configuration or try again later.');}
}
