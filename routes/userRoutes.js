const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const profilesDir = path.join(__dirname, '../uploads/profiles');
const coversDir = path.join(__dirname, '../uploads/covers');
if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });
if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'profile_photo') {
            cb(null, 'uploads/profiles/');
        } else {
            cb(null, 'uploads/covers/');
        }
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage, limits: { fileSize: 2 * 1024 * 1024 } });

router.post('/upload-profile', verifyToken, upload.single('profile_photo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const profilePhoto = req.file.filename;
    db.query('UPDATE users SET profile_photo = ? WHERE id = ?', [profilePhoto, req.user.id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, filename: profilePhoto });
    });
});

router.post('/upload-cover', verifyToken, upload.single('cover_photo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const coverPhoto = req.file.filename;
    db.query('UPDATE users SET cover_photo = ? WHERE id = ?', [coverPhoto, req.user.id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, filename: coverPhoto });
    });
});

router.get('/profile', verifyToken, (req, res) => {
    db.query('SELECT id, name, email, role, profile_photo, cover_photo, created_at FROM users WHERE id = ?', 
        [req.user.id], 
        (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, data: results[0] });
        });
});

module.exports = router;