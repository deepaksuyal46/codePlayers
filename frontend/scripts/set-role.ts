import './env';
import mongoose from 'mongoose';
import {db} from '../src/lib/db';
import {UserModel,Session} from '../src/lib/models';
import {OtpChallengeModel} from '../src/database/auth-models';
async function main(){const email=process.argv[2]?.trim().toLowerCase(),role=process.argv[3];if(!email||!['user','admin'].includes(role))throw new Error('Usage: npm run role:set -- account@example.com admin|user');await db();
 await mongoose.connection.transaction(async session=>{const u=await UserModel.findOne({email}).session(session);if(!u)throw new Error('Register this account through the website first');if(role==='admin'&&!u.phoneVerified)throw new Error('Verify this account phone through the website first');u.role=role;await u.save({session});await Session.deleteMany({userId:u._id},{session});await OtpChallengeModel.deleteMany({userId:u._id},{session});});
 console.log('Role updated. Existing sessions revoked. Sign in again using the matching tab.');}
main().catch(e=>{console.error(e.code?'Role update failed; database code '+e.code:e.message);process.exitCode=1;}).finally(()=>mongoose.disconnect());
