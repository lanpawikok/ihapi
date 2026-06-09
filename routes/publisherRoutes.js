const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, checkRole } = require('../middlewares/auth');

// Get all publishers
router.get('/', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    db.query('SELECT * FROM publishers ORDER BY id DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

// Create publisher
router.post('/', verifyToken, checkRole(['admin']), (req, res) => {
    const { name, address, phone, email } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: 'Publisher name is required' });
    }
    db.query('INSERT INTO publishers (name, address, phone, email) VALUES (?, ?, ?, ?)',
        [name, address || null, phone || null, email || null],
        (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, data: { id: result.insertId, name, address, phone, email } });
        });
});

// Update publisher
router.put('/:id', verifyToken, checkRole(['admin']), (req, res) => {
    const { name, address, phone, email } = req.body;
    db.query('UPDATE publishers SET name = ?, address = ?, phone = ?, email = ? WHERE id = ?',
        [name, address, phone, email, req.params.id],
        (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, message: 'Publisher updated' });
        });
});

// Delete publisher
router.delete('/:id', verifyToken, checkRole(['admin']), (req, res) => {
    db.query('DELETE FROM publishers WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Publisher deleted' });
    });
});

module.exports = router;