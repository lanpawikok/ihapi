-- 010_seed_initial_data.sql
-- Insert admin user (password: password)
INSERT INTO users (name, email, password, role) VALUES 
('Admin User', 'admin@bookshop.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON DUPLICATE KEY UPDATE id=id;

-- Insert cashier user
INSERT INTO users (name, email, password, role) VALUES 
('Cashier User', 'cashier@bookshop.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cashier')
ON DUPLICATE KEY UPDATE id=id;

-- Insert categories
INSERT INTO categories (name, description) VALUES 
('Fiction', 'Fiction books'),
('Non-Fiction', 'Non-fiction books'),
('Science', 'Science books')
ON DUPLICATE KEY UPDATE name=name;

-- Insert publishers
INSERT INTO publishers (name, address, phone, email) VALUES 
('Gramedia', 'Jakarta', '021123456', 'gramedia@email.com'),
('Erlangga', 'Bandung', '022123456', 'erlangga@email.com')
ON DUPLICATE KEY UPDATE name=name;
