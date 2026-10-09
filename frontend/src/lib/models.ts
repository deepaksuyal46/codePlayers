import mongoose,{Schema} from 'mongoose';
import {OtpChallengeModel} from '@/database/auth-models';
const opts={timestamps:true,versionKey:false} as const;
// Explicit Mixed fields contain server-validated DTO snapshots, not executable queries.
const model=(name:string, schema:Schema):mongoose.Model<any>=>mongoose.models[name]||mongoose.model(name,schema);
const ps=new Schema({sku:{type:String,required:true,unique:true},slug:{type:String,required:true,unique:true},title:String,category:String,description:String,pricePaise:Number,image:String,imageLite:String,color:String,active:{type:Boolean,default:true},demo:Boolean,source:String,catalogue:Schema.Types.Mixed,sourceRecord:Schema.Types.Mixed},opts);
ps.index({title:'text',description:'text',category:'text'});
ps.index({active:1,category:1,pricePaise:1,_id:1});
export const ProductModel=model('CPProduct',ps);
const referenceSchema=new Schema({kind:String,sourceId:String,record:Schema.Types.Mixed},opts);
referenceSchema.index({kind:1,sourceId:1},{unique:true});
export const CatalogueReference=model('CPCatalogueReference',referenceSchema);
export const Inventory=model('CPInventory',new Schema({sku:{type:String,required:true,unique:true},available:{type:Number,min:0},reserved:{type:Number,min:0},sold:{type:Number,min:0}},opts));
export const UserModel=model('CPUser',new Schema({email:{type:String,required:true,unique:true,lowercase:true,trim:true},name:String,passwordHash:String,role:{type:String,enum:['user','admin'],default:'user',required:true},emailVerified:{type:Boolean,default:false},phone:{type:String},phoneVerified:{type:Boolean,default:false},twoFactorEnabled:{type:Boolean,default:false}},opts));
UserModel.schema.index({phone:1},{unique:true,partialFilterExpression:{phone:{$type:'string'}}});
const ss=new Schema({tokenHash:{type:String,unique:true},userId:{type:Schema.Types.ObjectId,required:true},expiresAt:Date,authLevel:{type:String,enum:['password','two_factor'],default:'password'}},opts);ss.index({expiresAt:1},{expireAfterSeconds:0});
export const Session=model('CPSession',ss);
export const CartModel=model('CPCart',new Schema({userId:{type:Schema.Types.ObjectId,unique:true},version:{type:Number,default:0},items:{type:[{_id:false,sku:String,quantity:Number}],default:[]}},opts));
const cs=new Schema({userId:Schema.Types.ObjectId,key:String,requestHash:String,status:String,expiresAt:Date,quote:Schema.Types.Mixed,address:Schema.Types.Mixed,cartSnapshot:Schema.Types.Mixed,orderId:Schema.Types.ObjectId},opts);cs.index({userId:1,key:1},{unique:true});cs.index({status:1,expiresAt:1});
export const Attempt=model('CPAttempt',cs);
const rs=new Schema({checkoutId:{type:Schema.Types.ObjectId,unique:true},userId:Schema.Types.ObjectId,status:String,expiresAt:Date,items:Schema.Types.Mixed},opts);rs.index({status:1,expiresAt:1});
export const Reservation=model('CPReservation',rs);
const os=new Schema({checkoutId:{type:Schema.Types.ObjectId,unique:true},userId:Schema.Types.ObjectId,lines:Schema.Types.Mixed,totalPaise:Number,address:Schema.Types.Mixed,status:String,paymentMode:String},opts);os.index({userId:1,createdAt:-1});
export const OrderModel=model('CPOrder',os);
export const Payment=model('CPPayment',new Schema({checkoutId:{type:Schema.Types.ObjectId,unique:true},mode:String,status:String,amountPaise:Number},opts));
const es=new Schema({eventId:{type:String,unique:true},type:String,payload:Schema.Types.Mixed,status:String,leasedUntil:Date,attempts:{type:Number,default:0},nextAttemptAt:Date},opts);es.index({status:1,nextAttemptAt:1});
export const Outbox=model('CPOutbox',es);
export const Notification=model('CPNotification',new Schema({eventId:{type:String,unique:true},userId:Schema.Types.ObjectId,message:String},opts));
const ls=new Schema({_id:String,count:Number,expiresAt:Date});ls.index({expiresAt:1},{expireAfterSeconds:0});
export const Limit=model('CPLimit',ls);
export async function indexes() { for(const m of [CatalogueReference,ProductModel,Inventory,UserModel,OtpChallengeModel,Session,CartModel,Attempt,Reservation,OrderModel,Payment,Outbox,Notification,Limit]) await m.createIndexes(); }

export {OtpChallengeModel} from '@/database/auth-models';
