const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, checkRole } = require('../middlewares/auth');

// Get all suppliers
router.get('/', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    db.query('SELECT * FROM suppliers ORDER BY id DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

// Create supplier
router.post('/', verifyToken, checkRole(['admin']), (req, res) => {
    const { name, contact_person, phone, address } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }
    db.query('INSERT INTO suppliers (name, contact_person, phone, address) VALUES (?, ?, ?, ?)',
        [name, contact_person || null, phone || null, address || null],
        (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, data: { id: result.insertId, name, contact_person, phone, address } });
        });
});

module.exports = router;