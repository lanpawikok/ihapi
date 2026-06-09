const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/auth');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/logout', verifyToken, authController.logout);
router.get('/me', verifyToken, authController.me);

module.exports = router;