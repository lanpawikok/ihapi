const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bookshop_db'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('✅ MySQL Connected...');
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'bookshop_secret_key_2024';
const JWT_EXPIRES_IN = '24h';

// ==================== MIDDLEWARE ====================
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access denied. No token provided.' 
        });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid token' 
        });
    }
};

// Middleware untuk cek role
const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. Insufficient permissions.' 
            });
        }
        next();
    };
};

// Upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// ==================== PUBLIC ENDPOINTS (Tanpa Auth) ====================
// Untuk toko online / customer website

// Get all books (public)
app.get('/api/public/books', (req, res) => {
    const query = `
        SELECT b.*, c.name as category_name, p.name as publisher_name 
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN publishers p ON b.publisher_id = p.id
        WHERE b.stock > 0
        ORDER BY b.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

// Get single book (public)
app.get('/api/public/books/:id', (req, res) => {
    const query = `
        SELECT b.*, c.name as category_name, p.name as publisher_name 
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN publishers p ON b.publisher_id = p.id
        WHERE b.id = ?
    `;
    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }
        res.json({ success: true, data: results[0] });
    });
});

// Get categories (public)
app.get('/api/public/categories', (req, res) => {
    db.query('SELECT * FROM categories', (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

// Register new customer (public)
app.post('/api/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    
    // Cek email sudah terdaftar
    db.query('SELECT id FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (results.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }
        
        // Hash password
        const hashedPassword = bcrypt.hashSync(password, 10);
        const userRole = role || 'customer';
        
        db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, userRole],
            (err, result) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Database error' });
                }
                res.json({ success: true, message: 'Registration successful', user_id: result.insertId });
            });
    });
});

// ==================== AUTH ROUTES ====================
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email and password are required' 
        });
    }
    
    const query = 'SELECT id, name, email, password, role FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ 
                success: false, 
                message: 'Database error' 
            });
        }
        
        if (results.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        const user = results[0];
        
        let validPassword = false;
        if (user.password.length === 60 && (user.password.startsWith('$2') || user.password.startsWith('$2a') || user.password.startsWith('$2y'))) {
            validPassword = await bcrypt.compare(password, user.password);
        } else {
            validPassword = (password === user.password);
        }
        
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    });
});

app.post('/api/logout', verifyToken, (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/me', verifyToken, (req, res) => {
    db.query('SELECT id, name, email, role FROM users WHERE id = ?', 
        [req.user.id], 
        (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, user: results[0] });
        });
});

// ==================== CATEGORIES CRUD (Only Admin) ====================
app.get('/api/categories', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    db.query('SELECT * FROM categories ORDER BY id DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

app.post('/api/categories', verifyToken, checkRole(['admin']), (req, res) => {
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
            res.json({ 
                success: true, 
                data: { id: result.insertId, name, description } 
            });
        });
});

app.put('/api/categories/:id', verifyToken, checkRole(['admin']), (req, res) => {
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

app.delete('/api/categories/:id', verifyToken, checkRole(['admin']), (req, res) => {
    db.query('DELETE FROM categories WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Category deleted' });
    });
});

// ==================== PUBLISHERS CRUD (Only Admin) ====================
app.get('/api/publishers', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    db.query('SELECT * FROM publishers ORDER BY id DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

app.post('/api/publishers', verifyToken, checkRole(['admin']), (req, res) => {
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

app.put('/api/publishers/:id', verifyToken, checkRole(['admin']), (req, res) => {
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

app.delete('/api/publishers/:id', verifyToken, checkRole(['admin']), (req, res) => {
    db.query('DELETE FROM publishers WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Publisher deleted' });
    });
});

// ==================== SUPPLIERS CRUD (Only Admin) ====================
app.get('/api/suppliers', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    db.query('SELECT * FROM suppliers ORDER BY id DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

app.post('/api/suppliers', verifyToken, checkRole(['admin']), (req, res) => {
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

app.put('/api/suppliers/:id', verifyToken, checkRole(['admin']), (req, res) => {
    const { name, contact_person, phone, address } = req.body;
    db.query('UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, address = ? WHERE id = ?',
        [name, contact_person, phone, address, req.params.id],
        (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, message: 'Supplier updated' });
        });
});

app.delete('/api/suppliers/:id', verifyToken, checkRole(['admin']), (req, res) => {
    db.query('DELETE FROM suppliers WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Supplier deleted' });
    });
});

// ==================== CUSTOMERS CRUD (Admin & Cashier) ====================
app.get('/api/customers', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    db.query('SELECT * FROM customers ORDER BY id DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

app.post('/api/customers', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    const { name, email, phone, address } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: 'Customer name is required' });
    }
    
    db.query('INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
        [name, email || null, phone || null, address || null],
        (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, data: { id: result.insertId, name, email, phone, address } });
        });
});

app.put('/api/customers/:id', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
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

app.delete('/api/customers/:id', verifyToken, checkRole(['admin']), (req, res) => {
    db.query('DELETE FROM customers WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Customer deleted' });
    });
});

// ==================== BOOKS CRUD ====================
app.get('/api/books', verifyToken, checkRole(['admin', 'cashier', 'customer']), (req, res) => {
    const query = `
        SELECT b.*, c.name as category_name, p.name as publisher_name 
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN publishers p ON b.publisher_id = p.id
        ORDER BY b.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

app.get('/api/books/:id', verifyToken, checkRole(['admin', 'cashier', 'customer']), (req, res) => {
    const query = `
        SELECT b.*, c.name as category_name, p.name as publisher_name 
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN publishers p ON b.publisher_id = p.id
        WHERE b.id = ?
    `;
    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }
        res.json({ success: true, data: results[0] });
    });
});

app.post('/api/books', verifyToken, checkRole(['admin']), upload.single('cover_image'), (req, res) => {
    const { title, isbn, category_id, publisher_id, price, stock, description } = req.body;
    const cover_image = req.file ? req.file.filename : null;
    
    if (!title || !isbn) {
        return res.status(400).json({ success: false, message: 'Title and ISBN are required' });
    }
    
    db.query('INSERT INTO books (title, isbn, category_id, publisher_id, price, stock, cover_image, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [title, isbn, category_id || null, publisher_id || null, price || 0, stock || 0, cover_image, description || null],
        (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error', error: err });
            }
            res.json({ success: true, data: { id: result.insertId, title, isbn, category_id, publisher_id, price, stock, cover_image, description } });
        });
});

app.put('/api/books/:id', verifyToken, checkRole(['admin']), upload.single('cover_image'), (req, res) => {
    const { title, isbn, category_id, publisher_id, price, stock, description } = req.body;
    let cover_image = req.body.cover_image;
    
    if (req.file) {
        cover_image = req.file.filename;
    }
    
    db.query('UPDATE books SET title = ?, isbn = ?, category_id = ?, publisher_id = ?, price = ?, stock = ?, cover_image = ?, description = ? WHERE id = ?',
        [title, isbn, category_id, publisher_id, price, stock, cover_image, description, req.params.id],
        (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, message: 'Book updated' });
        });
});

app.delete('/api/books/:id', verifyToken, checkRole(['admin']), (req, res) => {
    db.query('DELETE FROM books WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Book deleted' });
    });
});

// ==================== TRANSACTIONS ====================
app.post('/api/transactions', verifyToken, checkRole(['admin', 'cashier', 'customer']), (req, res) => {
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
        const calculateTotal = async () => {
            for (let item of items) {
                await new Promise((resolve, reject) => {
                    db.query('SELECT price FROM books WHERE id = ?', [item.book_id], (err, results) => {
                        if (err || results.length === 0) {
                            reject(err);
                        } else {
                            totalAmount += results[0].price * item.quantity;
                            resolve();
                        }
                    });
                });
            }
            
            db.query('INSERT INTO transactions (invoice_number, customer_id, user_id, total_amount, status) VALUES (?, ?, ?, ?, ?)',
                [invoiceNumber, customer_id, req.user.id, totalAmount, 'pending'],
                (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ success: false, message: 'Error creating transaction' });
                        });
                    }
                    
                    const transactionId = result.insertId;
                    let completed = 0;
                    
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
                                        
                                        completed++;
                                        if (completed === items.length) {
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
        };
        
        calculateTotal();
    });
});

app.get('/api/transactions', verifyToken, (req, res) => {
    let query;
    let params = [];
    
    if (req.user.role === 'customer') {
        query = `
            SELECT t.*, c.name as customer_name, u.name as user_name
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.user_id = ?
            ORDER BY t.created_at DESC
        `;
        params = [req.user.id];
    } else {
        query = `
            SELECT t.*, c.name as customer_name, u.name as user_name
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
        `;
    }
    
    db.query(query, params, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

app.get('/api/transactions/:id', verifyToken, (req, res) => {
    let query = `
        SELECT t.*, c.name as customer_name, u.name as user_name,
               td.*, b.title as book_title, b.price as book_price
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

app.put('/api/transactions/:id/status', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    const { status } = req.body;
    db.query('UPDATE transactions SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Transaction status updated' });
    });
});

// ==================== EXPORT ROUTES (Only Admin) ====================
app.get('/api/export/transactions', verifyToken, checkRole(['admin']), (req, res) => {
    const query = `
        SELECT t.invoice_number, c.name as customer_name, t.total_amount, t.status, t.created_at
        FROM transactions t
        LEFT JOIN customers c ON t.customer_id = c.id
        ORDER BY t.created_at DESC
    `;
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: results });
    });
});

// ==================== CHART DATA (Admin & Cashier) ====================
app.get('/api/chart/sales', verifyToken, checkRole(['admin', 'cashier']), (req, res) => {
    const query = `
        SELECT 
            DATE_FORMAT(created_at, '%M') as month,
            SUM(total_amount) as total_sales,
            COUNT(*) as transaction_count
        FROM transactions
        WHERE status = 'paid'
        GROUP BY MONTH(created_at)
        ORDER BY MONTH(created_at) DESC
        LIMIT 6
    `;
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ 
            success: true, 
            data: {
                labels: results.map(r => r.month),
                sales: results.map(r => r.total_sales),
                counts: results.map(r => r.transaction_count)
            }
        });
    });
});

// ==================== DASHBOARD STATS ====================
app.get('/api/dashboard/stats', verifyToken, (req, res) => {
    let queries;
    
    if (req.user.role === 'customer') {
        queries = {
            totalBooks: 'SELECT COUNT(*) as count FROM books',
            myTransactions: 'SELECT COUNT(*) as count FROM transactions WHERE user_id = ?',
            mySpending: 'SELECT SUM(total_amount) as total FROM transactions WHERE user_id = ? AND status = "paid"'
        };
        
        db.query(queries.totalBooks, (err, totalBooks) => {
            if (err) return res.status(500).json({ success: false, message: 'Database error' });
            
            db.query(queries.myTransactions, [req.user.id], (err, myTransactions) => {
                if (err) return res.status(500).json({ success: false, message: 'Database error' });
                
                db.query(queries.mySpending, [req.user.id], (err, mySpending) => {
                    if (err) return res.status(500).json({ success: false, message: 'Database error' });
                    
                    res.json({
                        success: true,
                        data: {
                            totalBooks: totalBooks[0].count,
                            myTransactions: myTransactions[0].count,
                            mySpending: mySpending[0].total || 0
                        }
                    });
                });
            });
        });
    } else {
        queries = {
            totalBooks: 'SELECT COUNT(*) as count FROM books',
            totalCustomers: 'SELECT COUNT(*) as count FROM customers',
            totalTransactions: 'SELECT COUNT(*) as count FROM transactions',
            totalRevenue: 'SELECT SUM(total_amount) as total FROM transactions WHERE status = "paid"',
            lowStock: 'SELECT COUNT(*) as count FROM books WHERE stock < 5'
        };
        
        db.query(queries.totalBooks, (err, totalBooks) => {
            if (err) return res.status(500).json({ success: false, message: 'Database error' });
            
            db.query(queries.totalCustomers, (err, totalCustomers) => {
                if (err) return res.status(500).json({ success: false, message: 'Database error' });
                
                db.query(queries.totalTransactions, (err, totalTransactions) => {
                    if (err) return res.status(500).json({ success: false, message: 'Database error' });
                    
                    db.query(queries.totalRevenue, (err, totalRevenue) => {
                        if (err) return res.status(500).json({ success: false, message: 'Database error' });
                        
                        db.query(queries.lowStock, (err, lowStock) => {
                            if (err) return res.status(500).json({ success: false, message: 'Database error' });
                            
                            res.json({
                                success: true,
                                data: {
                                    totalBooks: totalBooks[0].count,
                                    totalCustomers: totalCustomers[0].count,
                                    totalTransactions: totalTransactions[0].count,
                                    totalRevenue: totalRevenue[0].total || 0,
                                    lowStock: lowStock[0].count
                                }
                            });
                        });
                    });
                });
            });
        });
    }
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 BookShop API is ready!`);
    console.log(`🔗 API URL: http://localhost:${PORT}/api`);
    console.log(`🛒 Public API URL: http://localhost:${PORT}/api/public`);
});