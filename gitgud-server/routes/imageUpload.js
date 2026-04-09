const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();

//should make upload dir if doesnt exist since i have upload in .ign atm
const uploadDir = 'uploads/';
if(!fs.existsSync(uploadDir))
{
    fs.mkdirSync(uploadDir, {recursive: true});
}

//change this file if we going to cloud storage
const store = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },

    filename: (req, file, cb) => {
        //using x-user-id til db is setup, probably change to a check if logged in when complete
        const userId = req.headers['useriddata'] || 'unknowniddata';
        cb(null, `user-${userId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: store,
    limits: {
        //adjust size if needed
        fileSize: 5 * 1024 * 1024
    },
    
    fileFilter: (req, file, cb) => {
        const fileCheck = ['image/jpeg', 'image/jpg', 'image/png'];
        
        if(fileCheck.includes(file.mimetype))
        {
            cb(null, true);
        }
        else
        {
            cb(new Error('Picutre uploads accept only JPEG and PNG filetype'), false);
        }
    }
});

router.post('/', (req, res) => {
    const uploadSingle = upload.single('ProfilePic');

    uploadSingle(req, res, (err) => {
        const userId = req.headers['useriddata'];

        if(!userId)
        {
            //401 = unauth
            return res.status(401).json({message: "User Id not found"});
        }
        if(err)
        {
            //400 = bad req
            return res.status(400).json({message: err.message});
        }
        if(!req.file)
        {
            return res.status(400).json({ message: "No file"});
        }

        res.json({
            url: `http://localhost:3001/uploads/${req.file.filename}`,
            owner: userId
        });
    });
});

module.exports = router;