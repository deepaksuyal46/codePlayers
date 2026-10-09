import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {spawn} from 'node:child_process';
async function main(){const replica=await MongoMemoryReplSet.create({replSet:{count:1,storageEngine:'wiredTiger'}});try{for(const suite of ['scripts/auth-integration.ts','scripts/integration.ts']){const child=spawn(process.execPath,['--import','tsx',suite],{stdio:'inherit',env:{...process.env,TEST_MONGODB_URI:replica.getUri()}});const code=await new Promise<number>((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code??1));});if(code){process.exitCode=code;break;}}}finally{await replica.stop();}}
main().catch(e=>{console.error('Local replica-set test could not run:',e.message);process.exitCode=1;});
