const express = require('express');
const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
const app = express();
app.use(express.json());

// PRAVILEN MONGODB POVEZOVALNI NIZ
const MONGODB_URI = 'mongodb+srv://ai_ponudbe:db_password@cluster0.lj9uqns.mongodb.net/?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Povezan na MongoDB'))
    .catch(err => console.error('❌ MongoDB napaka:', err));

const offerSchema = new mongoose.Schema({
    id: String,
    date: String,
    validUntil: String,
    companyName: String,
    companyTaxId: String,
    customerName: String,
    customerEmail: String,
    items: Array,
    calculations: Object,
    pdfData: Buffer,
    createdAt: { type: Date, default: Date.now }
});
const Offer = mongoose.model('Offer', offerSchema);

async function generatePDF(offerData) {
    const html = `<!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Ponudba ${offerData.id}</title>
    <style>
        body { font-family: Arial; margin: 40px; }
        .header { text-align: center; border-bottom: 2px solid #4CAF50; padding-bottom: 20px; }
        .company { font-size: 24px; font-weight: bold; color: #4CAF50; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #4CAF50; color: white; }
        .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
    </style>
    </head>
    <body>
        <div class="header"><div class="company">${offerData.companyName}</div><h2>PONUDBA ${offerData.id}</h2></div>
        <p><strong>Datum:</strong> ${offerData.date}</p>
        <p><strong>Velja do:</strong> ${offerData.validUntil || '30 dni'}</p>
        <p><strong>Kupec:</strong> ${offerData.customerName}</p>
        <table><th>Opis</th><th>Količina</th><th>Cena (€)</th><th>Skupaj (€)</th></tr>
        ${offerData.items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.unitPrice}</td><td>${(i.quantity * i.unitPrice).toFixed(2)}</td></tr>`).join('')}
        </table>
        <div class="total">Skupaj: ${offerData.calculations.total} €</div>
    </body>
    </html>`;
    
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return pdf;
}

app.post('/api/offers/create', async (req, res) => {
    try {
        const { companyName, companyTaxId, customerName, customerEmail, items, validUntil } = req.body;
        if (!companyName || !customerName || !items || items.length === 0) {
            return res.status(400).json({ success: false, error: "Manjkajo obvezni podatki" });
        }
        
        let subtotal = 0;
        items.forEach(i => subtotal += i.quantity * i.unitPrice);
        const tax = subtotal * 0.22;
        const total = subtotal + tax;
        
        const validUntilDate = validUntil || (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })();
        
        const offerData = {
            id: 'P-' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            validUntil: validUntilDate,
            companyName,
            companyTaxId: companyTaxId || '',
            customerName,
            customerEmail: customerEmail || '',
            items: items.map(i => ({ name: i.name, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
            calculations: { subtotal: subtotal.toFixed(2), tax: tax.toFixed(2), total: total.toFixed(2) }
        };
        
        const pdfBuffer = await generatePDF(offerData);
        const offer = new Offer({ ...offerData, pdfData: pdfBuffer });
        await offer.save();
        
        res.json({ success: true, offer: offerData, offerId: offerData.id });
    } catch (error) {
        console.error('Napaka:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/offers/:id/pdf', async (req, res) => {
    try {
        const offer = await Offer.findOne({ id: req.params.id });
        if (!offer || !offer.pdfData) return res.status(404).send('PDF ne obstaja');
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `inline; filename="ponudba_${req.params.id}.pdf"`);
        res.send(offer.pdfData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/offers', async (req, res) => {
    const offers = await Offer.find({}, { pdfData: 0 }).sort({ createdAt: -1 });
    res.json({ success: true, offers });
});

app.delete('/api/offers/:id', async (req, res) => {
    await Offer.deleteOne({ id: req.params.id });
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>AI Ponudbe</title><style>
            body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .card { background: white; color: #333; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; }
            a { display: inline-block; margin: 10px; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; }
        </style></head>
        <body><h1>🤖 AI Ponudbe</h1><div class="card"><h2>API deluje! 🚀</h2><a href="/dashboard.html">📊 Dashboard</a></div></body>
        </html>
    `);
});

app.get('/dashboard.html', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Dashboard</title><style>
            body { font-family: Arial; padding: 20px; background: #f0f2f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            h1 { color: #667eea; }
            table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background: #667eea; color: white; }
            .btn-pdf { background: #4CAF50; color: white; padding: 5px 10px; text-decoration: none; border-radius: 5px; }
        </style></head>
        <body><div class="container"><h1>📊 Vse ponudbe</h1><table id="offersTable"><thead><tr><th>Številka</th><th>Datum</th><th>Podjetje</th><th>Stranka</th><th>Skupaj</th><th>PDF</th></tr></thead><tbody id="tbody"></tbody></table></div>
        <script>
            fetch('/api/offers').then(r=>r.json()).then(data=>{
                const tbody = document.getElementById('tbody');
                data.offers.forEach(offer => {
                    tbody.innerHTML += '<tr><td>' + offer.id + '</td><td>' + offer.date + '</td><td>' + offer.companyName + '</td><td>' + offer.customerName + '</td><td>' + offer.calculations.total + ' €</td><td><a href="/api/offers/' + offer.id + '/pdf" target="_blank" class="btn-pdf">📄 PDF</a></td></tr>';
                });
            });
        </script>
        </body>
        </html>
    `);
});

app.listen(3000, () => {
    console.log('✅ Server teče na http://localhost:3000');
    console.log('📁 Dashboard: http://localhost:3000/dashboard.html');
});