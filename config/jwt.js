module.exports = {
    secret: process.env.JWT_SECRET || 'bookshop_secret_key_2024',
    expiresIn: '24h'
};