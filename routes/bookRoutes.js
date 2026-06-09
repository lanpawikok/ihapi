const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { verifyToken, checkRole } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Semua role bisa lihat
router.get('/', verifyToken, checkRole(['admin', 'cashier', 'customer']), bookController.index);
router.get('/:id', verifyToken, checkRole(['admin', 'cashier', 'customer']), bookController.show);

// Hanya admin yang bisa modify
router.post('/', verifyToken, checkRole(['admin']), upload.single('cover_image'), bookController.store);
router.put('/:id', verifyToken, checkRole(['admin']), upload.single('cover_image'), bookController.update);
router.delete('/:id', verifyToken, checkRole(['admin']), bookController.destroy);

module.exports = router;