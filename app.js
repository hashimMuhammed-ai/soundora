const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
require('dotenv').config();
const passport = require('./config/passport');
const mongoose = require('mongoose');
const db = require('./config/db');
db();


const app = express();


// Middlewares
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 72*60*60*1000
  }
}));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');   // For older HTTP/1.0 proxies
  res.set('Expires', '0');         // Make sure it expires immediately
  next();
});

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());



// View Engine
app.set('view engine','ejs');




app.use((req, res, next)=>{
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
})



const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const { baseModelName } = require('./models/userModel');

app.use('/admin', adminRoutes);
app.use('/', userRoutes);


const PORT = process.env.PORT || 3241;
app.listen(PORT, ()=>{
  console.log(`Server running on port: http://localhost:${PORT}`);
})