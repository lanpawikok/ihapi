const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, checkRole } = require('../middlewares/auth');

// Get all categories
router.get('/', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    db.query('SELECT * FROM categories ORDER BY id DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

// Get single category
router.get('/:id', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    db.query('SELECT * FROM categories WHERE id = ?', [req.params.id], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.json({ success: true, data: results[0] });
    });
});

// Create category
router.post('/', verifyToken, checkRole(['admin']), (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    db.query('INSERT INTO categories (name, description) VALUES (?, ?)', 
        [name, description || null], 
        (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, data: { id: result.insertId, name, description } });
        });
});

// Update category
router.put('/:id', verifyToken, checkRole(['admin']), (req, res) => {
    const { name, description } = req.body;
    db.query('UPDATE categories SET name = ?, description = ? WHERE id = ?',
        [name, description, req.params.id],
        (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, message: 'Category updated' });
        });
});

// Delete category
router.delete('/:id', verifyToken, checkRole(['admin']), (req, res) => {
    db.query('DELETE FROM categories WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Category deleted' });
    });
});

module.exports = router;