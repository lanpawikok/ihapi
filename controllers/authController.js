    const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config/jwt');

exports.login = async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    
    db.query('SELECT id, name, email, password, role FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        
        const user = results[0];
        let validPassword = false;
        
        if (user.password.length === 60 && (user.password.startsWith('$2'))) {
            validPassword = await bcrypt.compare(password, user.password);
        } else {
            validPassword = (password === user.password);
        }
        
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            config.secret,
            { expiresIn: config.expiresIn }
        );
        
        res.json({
            success: true,
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    });
};

exports.register = async (req, res) => {
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    
    db.query('SELECT id FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (results.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }
        
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
};

exports.me = (req, res) => {
    db.query('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, user: results[0] });
    });
};

exports.logout = (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
};