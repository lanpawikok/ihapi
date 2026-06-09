-- 007_create_book_supplier_table.sql
CREATE TABLE IF NOT EXISTS book_supplier (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    supplier_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

