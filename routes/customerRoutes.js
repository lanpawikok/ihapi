const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, checkRole } = require('../middlewares/auth');

// Get all customers
router.get('/', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    db.query('SELECT * FROM customers ORDER BY id DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

// Get single customer
router.get('/:id', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    db.query('SELECT * FROM customers WHERE id = ?', [req.params.id], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        res.json({ success: true, data: results[0] });
    });
});

// Create customer
router.post('/', verifyToken, checkRole(['admin', 'cashier', 'customer']), (req, res) => {
    const { name, email, phone, address } = req.body;
    
    if (!name) {
        return res.status(400).json({ success: false, message: 'Customer name is required' });
    }
    
    db.query('INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
        [name, email || null, phone || null, address || null],
        (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
            }
            res.json({ 
                success: true, 
                data: { id: result.insertId, name, email, phone, address } 
            });
        });
});

// Update customer
router.put('/:id', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    const { name, email, phone, address } = req.body;
    
    db.query('UPDATE customers SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
        [name, email, phone, address, req.params.id],
        (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, message: 'Customer updated' });
        });
});

// Delete customer
router.delete('/:id', verifyToken, checkRole(['admin']), (req, res) => {
    db.query('DELETE FROM customers WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Customer deleted' });
    });
});

module.exports = router;