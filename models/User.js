const db = require('../config/database');

const User = {
    findByEmail: (email, callback) => {
        db.query('SELECT id, name, email, password, role FROM users WHERE email = ?', [email], callback);
    },
    
    findById: (id, callback) => {
        db.query('SELECT id, name, email, role FROM users WHERE id = ?', [id], callback);
    },
    
    create: (data, callback) => {
        db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [data.name, data.email, data.password, data.role || 'customer'], callback);
    }
};

module.exports = User;