import './env';
import mongoose from 'mongoose';
import {expireBatch,drainOutbox} from '../src/lib/commerce';
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
async function main(){console.log('Worker running: reservation expiry + durable demo notification sink. Ctrl+C to stop.');while(!stopping){try{const released=await expireBatch();await drainOutbox();if(released)console.log('Expired holds released:',released);}catch(e:any){console.error('Worker cycle failed:',e.name,e.code||'Check database availability');}await new Promise(r=>setTimeout(r,2000));}await mongoose.disconnect();}
main().catch(()=>{process.exitCode=1;});
