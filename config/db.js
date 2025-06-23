const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = () => {
  mongoose.connect(process.env.MONGO_URI)
  .then(()=>console.log('DB Connected'))
  .catch((err)=>console.log(err));
}

module.exports = connectDB;