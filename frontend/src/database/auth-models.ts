import mongoose,{Schema} from 'mongoose';
const schema=new Schema({
 _id:{type:String,required:true},email:{type:String,required:true},phone:{type:String,required:true},
 purpose:{type:String,enum:['registration','enrollment','login'],required:true},
 name:String,passwordHash:String,userId:Schema.Types.ObjectId,roleSnapshot:String,
 codeDigest:{type:String,required:true},expiresAt:{type:Date,required:true},resendAfter:{type:Date,required:true},
 attempts:{type:Number,default:0},status:{type:String,enum:['sending','active','verifying','consumed','locked'],required:true}
},{timestamps:true,versionKey:false});
schema.index({expiresAt:1},{expireAfterSeconds:0});
schema.index({email:1,purpose:1,createdAt:-1});
export const OtpChallengeModel:mongoose.Model<any>=mongoose.models.CPPhoneOtpChallenge||mongoose.model('CPPhoneOtpChallenge',schema);
