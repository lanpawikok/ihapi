const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all books (public) - dengan filter kategori
router.get('/books', (req, res) => {
    let query = `
        SELECT b.*, c.name as category_name, p.name as publisher_name 
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN publishers p ON b.publisher_id = p.id
        WHERE b.stock > 0
    `;
    
    const params = [];
    
    // Filter by category
    if (req.query.category_id) {
        query += ' AND b.category_id = ?';
        params.push(req.query.category_id);
    }
    
    query += ' ORDER BY b.id DESC';
    
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Public books error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

// Get single book (public)
router.get('/books/:id', (req, res) => {
    const query = `
        SELECT b.*, c.name as category_name, p.name as publisher_name 
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN publishers p ON b.publisher_id = p.id
        WHERE b.id = ?
    `;
    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            console.error('Public book detail error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }
        res.json({ success: true, data: results[0] });
    });
});

// Get categories (public)
router.get('/categories', (req, res) => {
    db.query('SELECT * FROM categories', (err, results) => {
        if (err) {
            console.error('Public categories error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

module.exports = router;