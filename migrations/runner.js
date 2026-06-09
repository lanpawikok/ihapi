const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigrations() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'bookshop_db'
        });
        
        console.log(' Database connected');
        
        const isFresh = process.argv.includes('--fresh');
        
        if (isFresh) {
            console.log(' Running fresh migration...');
            
            await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
            
            const tablesToDrop = [
                'transaction_details',
                'book_supplier',
                'transactions',
                'books',
                'customers',
                'users',
                'categories',
                'publishers',
                'suppliers',
                'migrations'
            ];
            
            for (const tableName of tablesToDrop) {
                try {
                    await connection.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
                    console.log(`   Dropped table: ${tableName}`);
                } catch (err) {
                    console.log(`   Table ${tableName} not found`);
                }
            }
            
            await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
            console.log('   Cleared all tables');
        }
        
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        const [executed] = await connection.execute('SELECT name FROM migrations');
        const executedNames = executed.map(row => row.name);
        
        const files = fs.readdirSync(__dirname);
        const migrationFiles = files
            .filter(file => file.endsWith('.sql') && file !== 'runner.js')
            .sort();
        
        console.log(`\n Found ${migrationFiles.length} migration files`);
        
        for (const file of migrationFiles) {
            if (!executedNames.includes(file)) {
                console.log(`\n Running migration: ${file}`);
                
                const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
                const queries = sql.split(';').filter(q => q.trim());
                
                for (const query of queries) {
                    if (query.trim()) {
                        await connection.execute(query);
                    }
                }
                
                await connection.execute('INSERT INTO migrations (name) VALUES (?)', [file]);
                console.log(` Migration ${file} completed`);
            } else {
                console.log(`  Skipping ${file} (already executed)`);
            }
        }
        
        console.log('\n All migrations completed successfully!');
        
    } catch (error) {
        console.error('\n Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

runMigrations();