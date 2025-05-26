const path=require('path');
require('dotenv').config({path:path.resolve(__dirname,'..','.env')});
const mongoose=require('mongoose');


const connectdb=async ()=>{
    await mongoose.connect(process.env.MONGODB_URI);
}

module.exports={connectdb};