const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, checkRole } = require('../middlewares/auth');

// Get all transactions
router.get('/', verifyToken, (req, res) => {
    let query;
    let params = [];
    
    if (req.user.role === 'customer') {
        query = `SELECT t.*, c.name as customer_name FROM transactions t 
                 LEFT JOIN customers c ON t.customer_id = c.id 
                 WHERE t.user_id = ? ORDER BY t.created_at DESC`;
        params = [req.user.id];
    } else {
        query = `SELECT t.*, c.name as customer_name, u.name as user_name 
                 FROM transactions t 
                 LEFT JOIN customers c ON t.customer_id = c.id 
                 LEFT JOIN users u ON t.user_id = u.id 
                 ORDER BY t.created_at DESC`;
    }
    
    db.query(query, params, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

// Get single transaction
router.get('/:id', verifyToken, (req, res) => {
    const query = `
        SELECT t.*, c.name as customer_name, u.name as user_name,
               td.*, b.title as book_title
        FROM transactions t
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN transaction_details td ON t.id = td.transaction_id
        LEFT JOIN books b ON td.book_id = b.id
        WHERE t.id = ?
    `;
    
    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }
        
        if (req.user.role === 'customer' && results[0].user_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        res.json({ success: true, data: results });
    });
});

// Create transaction
router.post('/', verifyToken, checkRole(['admin', 'cashier', 'customer']), (req, res) => {
    const { customer_id, items } = req.body;
    const invoiceNumber = 'INV-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    if (!customer_id || !items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Customer and items are required' });
    }
    
    db.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Transaction error' });
        }
        
        let totalAmount = 0;
        let itemsProcessed = 0;
        
        items.forEach(item => {
            db.query('SELECT price FROM books WHERE id = ?', [item.book_id], (err, results) => {
                if (err || results.length === 0) {
                    return db.rollback(() => {
                        res.status(500).json({ success: false, message: 'Book not found' });
                    });
                }
                totalAmount += results[0].price * item.quantity;
                itemsProcessed++;
                
                if (itemsProcessed === items.length) {
                    db.query('INSERT INTO transactions (invoice_number, customer_id, user_id, total_amount, status) VALUES (?, ?, ?, ?, ?)',
                        [invoiceNumber, customer_id, req.user.id, totalAmount, 'pending'],
                        (err, result) => {
                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({ success: false, message: 'Error creating transaction' });
                                });
                            }
                            
                            const transactionId = result.insertId;
                            let detailsProcessed = 0;
                            
                            items.forEach(item => {
                                db.query('SELECT price, stock FROM books WHERE id = ?', [item.book_id], (err, bookResult) => {
                                    if (err || bookResult.length === 0) {
                                        return db.rollback(() => {
                                            res.status(500).json({ success: false, message: 'Book not found' });
                                        });
                                    }
                                    
                                    const price = bookResult[0].price;
                                    const currentStock = bookResult[0].stock;
                                    
                                    if (currentStock < item.quantity) {
                                        return db.rollback(() => {
                                            res.status(400).json({ success: false, message: `Insufficient stock for book ID ${item.book_id}` });
                                        });
                                    }
                                    
                                    db.query('INSERT INTO transaction_details (transaction_id, book_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)',
                                        [transactionId, item.book_id, item.quantity, price, price * item.quantity],
                                        (err) => {
                                            if (err) {
                                                return db.rollback(() => {
                                                    res.status(500).json({ success: false, message: 'Error creating transaction detail' });
                                                });
                                            }
                                            
                                            db.query('UPDATE books SET stock = stock - ? WHERE id = ?', [item.quantity, item.book_id], (err) => {
                                                if (err) {
                                                    return db.rollback(() => {
                                                        res.status(500).json({ success: false, message: 'Error updating stock' });
                                                    });
                                                }
                                                
                                                detailsProcessed++;
                                                if (detailsProcessed === items.length) {
                                                    db.commit((err) => {
                                                        if (err) {
                                                            return db.rollback(() => {
                                                                res.status(500).json({ success: false, message: 'Commit error' });
                                                            });
                                                        }
                                                        res.json({ 
                                                            success: true, 
                                                            message: 'Transaction successful', 
                                                            data: { invoice_number: invoiceNumber, total_amount: totalAmount }
                                                        });
                                                    });
                                                }
                                            });
                                        });
                                });
                            });
                        });
                }
            });
        });
    });
});

// ==================== UPDATE STATUS (TAMBAHKAN INI) ====================
router.put('/:id/status', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    const { status } = req.body;
    const validStatus = ['pending', 'paid', 'cancelled'];
    
    if (!status || !validStatus.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status. Must be pending, paid, or cancelled' });
    }
    
    db.query('UPDATE transactions SET status = ? WHERE id = ?', [status, req.params.id], (err, result) => {
        if (err) {
            console.error('Update status error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }
        res.json({ success: true, message: 'Transaction status updated to ' + status });
    });
});

module.exports = router;