const db = require('../config/database');

exports.index = (req, res) => {
    const query = `
        SELECT b.*, c.name as category_name, p.name as publisher_name 
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN publishers p ON b.publisher_id = p.id
        ORDER BY b.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Index error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
};

exports.show = (req, res) => {
    const query = `
        SELECT b.*, c.name as category_name, p.name as publisher_name 
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN publishers p ON b.publisher_id = p.id
        WHERE b.id = ?`;
    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            console.error('Show error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }
        res.json({ success: true, data: results[0] });
    });
};

exports.store = (req, res) => {
    const { title, isbn, category_id, publisher_id, price, stock, description } = req.body;
    const cover_image = req.file ? req.file.filename : null;
    
    if (!title || !isbn) {
        return res.status(400).json({ success: false, message: 'Title and ISBN are required' });
    }
    
    const query = `INSERT INTO books (title, isbn, category_id, publisher_id, price, stock, cover_image, description) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [title, isbn, category_id || null, publisher_id || null, price || 0, stock || 0, cover_image, description || null];
    
    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Store error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }
        res.json({ 
            success: true, 
            data: { id: result.insertId, title, isbn, category_id, publisher_id, price, stock, cover_image, description } 
        });
    });
};

exports.update = (req, res) => {
    const { title, isbn, category_id, publisher_id, price, stock, description } = req.body;
    let cover_image = req.body.cover_image;
    
    if (req.file) {
        cover_image = req.file.filename;
    }
    
    if (!title || !isbn) {
        return res.status(400).json({ success: false, message: 'Title and ISBN are required' });
    }
    
    const query = `UPDATE books SET 
        title = ?, 
        isbn = ?, 
        category_id = ?, 
        publisher_id = ?, 
        price = ?, 
        stock = ?, 
        cover_image = ?, 
        description = ? 
        WHERE id = ?`;
    
    const values = [title, isbn, category_id, publisher_id, price, stock, cover_image, description, req.params.id];
    
    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Update error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }
        res.json({ success: true, message: 'Book updated' });
    });
};

exports.destroy = (req, res) => {
    db.query('DELETE FROM books WHERE id = ?', [req.params.id], (err, result) => {
        if (err) {
            console.error('Delete error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }
        res.json({ success: true, message: 'Book deleted' });
    });
};