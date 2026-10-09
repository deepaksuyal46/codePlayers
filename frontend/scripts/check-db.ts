import './env';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {db} from '../src/lib/db';
import {indexes} from '../src/lib/models';
async function main(){await db();await indexes();const database=mongoose.connection.db!;await database.admin().ping();const collection=database.collection<{_id:string}>('cp_connection_checks');await collection.updateOne({_id:'schema-check'},{$set:{_id:'schema-check'}},{upsert:true});const probe=randomUUID();const marker=new Error('EXPECTED_ROLLBACK');try{await mongoose.connection.transaction(async session=>{await collection.insertOne({_id:probe},{session});throw marker;});}catch(e){if(e!==marker)throw e;}if(await collection.findOne({_id:probe}))throw new Error('Rollback did not occur');await collection.deleteOne({_id:'schema-check'});console.log('PASS: MongoDB ping, index creation and transaction rollback.');}
main()
  .catch((error) => {
    const message = String(error.message || 'Unknown error')
      .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[URI hidden]');

    console.error('Database check failed:', error.name);
    console.error('Reason:', message);
    console.error('Code:', error.code ?? 'none');
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());