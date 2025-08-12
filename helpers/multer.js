const multer = require('multer');
const path = require('path');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'image') {
      cb(null, 'public/uploads/brands');
    } else if (file.fieldname === 'images') {
      cb(null, 'public/uploads/profile-images');
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
  

module.exports = storage;