const adminAuth = (req, res, next) => {
  if(req.session.admin){
    next();
  }
  else {
    res.redirect('/admin/login');
  }
}

const adminLoginAuth = (req, res, next) => {
  if(!req.session.admin){
    next()
  }else {
    res.redirect('/admin/dashboard')
  }
}

const userAuth = (req, res, next) => {
  if(req.session.user){
    next();
  }
  else {
    res.redirect('/login');
  }
}


const userLoginAuth = (req, res, next) => {
  if(!req.session.user){
    next();
  }else {
    res.redirect('/');
  }
}

module.exports = {adminAuth, userAuth, adminLoginAuth, userLoginAuth};