import {openDB} from 'idb';
import type {Cart} from './types';
export class ApiError extends Error {constructor(public code:string,message:string,public status:number){super(message);}}
export async function api<T>(path:string,method='GET',body?:unknown,headers:Record<string,string>={}):Promise<T>{
 const response=await fetch('/api'+path,{method,credentials:'same-origin',cache:'no-store',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(path.startsWith('/auth/')?30000:12000)});
 const value=await response.json();if(!response.ok)throw new ApiError(value.error?.code||'ERROR',value.error?.message||'Request failed',response.status);return value.data;
}
const database=()=>openDB('codeplayers-cart-v1',1,{upgrade(db){db.createObjectStore('carts');}});
export type LocalCart={cart:Cart;pending:boolean;baseVersion:number};
export async function loadLocal(userId:string):Promise<LocalCart|undefined>{return (await database()).get('carts',userId);}
export async function saveLocal(userId:string,value:LocalCart){return (await database()).put('carts',value,userId);}
export async function removeLocal(userId:string){return (await database()).delete('carts',userId);}
export const money=(paise:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(paise/100);
