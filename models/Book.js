const db = require('../config/database');

const Book = {
    findAll: (callback) => {
        const query = `
            SELECT b.*, c.name as category_name, p.name as publisher_name 
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.id
            LEFT JOIN publishers p ON b.publisher_id = p.id
            ORDER BY b.id DESC
        `;
        db.query(query, callback);
    },
    
    findById: (id, callback) => {
        const query = `
            SELECT b.*, c.name as category_name, p.name as publisher_name 
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.id
            LEFT JOIN publishers p ON b.publisher_id = p.id
            WHERE b.id = ?
        `;
        db.query(query, [id], callback);
    },
    
    create: (data, callback) => {
        db.query('INSERT INTO books (title, isbn, category_id, publisher_id, price, stock, cover_image, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [data.title, data.isbn, data.category_id, data.publisher_id, data.price, data.stock, data.cover_image, data.description], callback);
    },
    
    update: (id, data, callback) => {
        db.query('UPDATE books SET title = ?, isbn = ?, category_id = ?, publisher_id = ?, price = ?, stock = ?, cover_image = ?, description = ? WHERE id = ?',
            [data.title, data.isbn, data.category_id, data.publisher_id, data.price, data.stock, data.cover_image, data.description, id], callback);
    },
    
    delete: (id, callback) => {
        db.query('DELETE FROM books WHERE id = ?', [id], callback);
    }
};

module.exports = Book;