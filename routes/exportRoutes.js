const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, checkRole } = require('../middlewares/auth');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Export to Excel
router.get('/excel', verifyToken, checkRole(['admin']), async (req, res) => {
    try {
        const { start_date, end_date, status } = req.query;
        
        let query = `
            SELECT t.invoice_number, c.name as customer_name, t.total_amount, t.status, t.created_at
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.id
            WHERE 1=1
        `;
        const params = [];
        
        if (start_date) {
            query += ' AND DATE(t.created_at) >= ?';
            params.push(start_date);
        }
        if (end_date) {
            query += ' AND DATE(t.created_at) <= ?';
            params.push(end_date);
        }
        if (status && status !== 'all') {
            query += ' AND t.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY t.created_at DESC';
        
        db.query(query, params, async (err, results) => {
            if (err) {
                console.error('Export error:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            
            // Create Excel workbook
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Transactions');
            
            // Add headers
            worksheet.columns = [
                { header: 'Invoice Number', key: 'invoice_number', width: 25 },
                { header: 'Customer Name', key: 'customer_name', width: 25 },
                { header: 'Total Amount', key: 'total_amount', width: 15 },
                { header: 'Status', key: 'status', width: 20 },
                { header: 'Date', key: 'created_at', width: 20 }
            ];
            
            // Style header
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            
            // Add data
            results.forEach(row => {
                worksheet.addRow({
                    invoice_number: row.invoice_number,
                    customer_name: row.customer_name || '-',
                    total_amount: `Rp ${new Intl.NumberFormat('id-ID').format(row.total_amount)}`,
                    status: row.status === 'pending' ? 'Menunggu Pembayaran' : (row.status === 'paid' ? 'Dibayar' : 'Dibatalkan'),
                    created_at: new Date(row.created_at).toLocaleString('id-ID')
                });
            });
            
            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=transactions.xlsx');
            
            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (error) {
        console.error('Export Excel error:', error);
        res.status(500).json({ success: false, message: 'Export failed' });
    }
});

// Export to PDF
router.get('/pdf', verifyToken, checkRole(['admin']), async (req, res) => {
    try {
        const { start_date, end_date, status } = req.query;
        
        let query = `
            SELECT t.invoice_number, c.name as customer_name, t.total_amount, t.status, t.created_at
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.id
            WHERE 1=1
        `;
        const params = [];
        
        if (start_date) {
            query += ' AND DATE(t.created_at) >= ?';
            params.push(start_date);
        }
        if (end_date) {
            query += ' AND DATE(t.created_at) <= ?';
            params.push(end_date);
        }
        if (status && status !== 'all') {
            query += ' AND t.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY t.created_at DESC';
        
        db.query(query, params, async (err, results) => {
            if (err) {
                console.error('Export error:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            
            // Create PDF
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=transactions.pdf');
            
            doc.pipe(res);
            
            // Header
            doc.fontSize(20).font('Helvetica-Bold').text('Laporan Transaksi', { align: 'center' });
            doc.moveDown();
            doc.fontSize(10).font('Helvetica').text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, { align: 'center' });
            doc.moveDown();
            
            // Filter info
            if (start_date || end_date || status) {
                doc.fontSize(9).text('Filter:', { continued: true });
                if (start_date) doc.text(` Dari: ${start_date}`, { continued: true });
                if (end_date) doc.text(` Sampai: ${end_date}`, { continued: true });
                if (status && status !== 'all') {
                    const statusText = status === 'pending' ? 'Menunggu Pembayaran' : (status === 'paid' ? 'Dibayar' : 'Dibatalkan');
                    doc.text(` Status: ${statusText}`);
                } else {
                    doc.text('');
                }
            }
            
            doc.moveDown();
            
            // Table headers
            const startX = 50;
            let currentY = doc.y;
            
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('Invoice', startX, currentY);
            doc.text('Customer', startX + 100, currentY);
            doc.text('Total', startX + 200, currentY);
            doc.text('Status', startX + 280, currentY);
            doc.text('Tanggal', startX + 370, currentY);
            
            doc.moveDown();
            currentY = doc.y;
            
            // Draw line
            doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(startX, currentY - 5).lineTo(startX + 500, currentY - 5).stroke();
            
            // Table rows
            doc.fontSize(8).font('Helvetica');
            results.forEach((row, index) => {
                if (currentY > 700) {
                    doc.addPage();
                    currentY = 50;
                }
                
                const statusText = row.status === 'pending' ? 'Menunggu' : (row.status === 'paid' ? 'Dibayar' : 'Dibatalkan');
                
                doc.text(row.invoice_number, startX, currentY);
                doc.text((row.customer_name || '-').substring(0, 20), startX + 100, currentY);
                doc.text(`Rp ${new Intl.NumberFormat('id-ID').format(row.total_amount)}`, startX + 200, currentY);
                doc.text(statusText, startX + 280, currentY);
                doc.text(new Date(row.created_at).toLocaleDateString('id-ID'), startX + 370, currentY);
                
                currentY += 20;
            });
            
            // Footer
            doc.moveDown();
            doc.fontSize(8).text(`Total Transaksi: ${results.length}`, { align: 'center' });
            const totalRevenue = results.reduce((sum, row) => sum + row.total_amount, 0);
            doc.text(`Total Pendapatan: Rp ${new Intl.NumberFormat('id-ID').format(totalRevenue)}`, { align: 'center' });
            
            doc.end();
        });
    } catch (error) {
        console.error('Export PDF error:', error);
        res.status(500).json({ success: false, message: 'Export failed' });
    }
});

module.exports = router;