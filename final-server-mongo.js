const express = require('express');
const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
const app = express();
app.use(express.json());

const MONGODB_URI = 'mongodb+srv://ai_ponudbe:ponudbe2026@cluster0.lj9uqs.mongodb.net/?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Povezan na MongoDB'))
    .catch(err => console.error('❌ MongoDB napaka:', err));

const offerSchema = new mongoose.Schema({
    id: String, date: String, validUntil: String,
    companyName: String, companyTaxId: String,
    customerName: String, customerEmail: String,
    items: Array, calculations: Object, pdfData: Buffer
});
const Offer = mongoose.model('Offer', offerSchema);

async function generatePDF(offerData) {
    const html = `<!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Ponudba ${offerData.id}</title>
    <style>
        body { font-family: Arial; margin: 40px; }
        .header { text-align: center; border-bottom: 2px solid #4CAF50; }
        .company { font-size: 24px; font-weight: bold; color: #4CAF50; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; }
        th { background: #4CAF50; color: white; }
        .total { font-size: 18px; font-weight: bold; text-align: right; }
    </style>
    </head>
    <body>
        <div class="header"><div class="company">${offerData.companyName}</div><h2>PONUDBA ${offerData.id}</h2></div>
        <p><strong>Datum:</strong> ${offerData.date}</p>
        <p><strong>Kupec:</strong> ${offerData.customerName}</p>
        <table><th>Opis</th><th>Količina</th><th>Cena</th><th>Skupaj</th></tr>
        ${offerData.items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.unitPrice} €</td><td>${(i.quantity * i.unitPrice).toFixed(2)} €</td></tr>`).join('')}
        </table>
        <div class="total">Skupaj: ${offerData.calculations.total} €</div>
    </body>
    </html>`;
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html);
    const pdf = await page.pdf({ format: 'A4' });
    await browser.close();
    return pdf;
}

app.post('/api/offers/create', async (req, res) => {
    try {
        const { companyName, customerName, items } = req.body;
        if (!companyName || !customerName || !items) return res.status(400).json({ error: 'Manjkajo podatki' });
        let subtotal = 0;
        items.forEach(i => subtotal += i.quantity * i.unitPrice);
        const tax = subtotal * 0.22;
        const total = subtotal + tax;
        const offerData = {
            id: 'P-' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            companyName, customerName,
            items,
            calculations: { subtotal: subtotal.toFixed(2), tax: tax.toFixed(2), total: total.toFixed(2) }
        };
        const pdfBuffer = await generatePDF(offerData);
        const offer = new Offer({ ...offerData, pdfData: pdfBuffer });
        await offer.save();
        res.json({ success: true, offer: offerData, offerId: offerData.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/offers/:id/pdf', async (req, res) => {
    const offer = await Offer.findOne({ id: req.params.id });
    if (!offer || !offer.pdfData) return res.status(404).send('PDF ne obstaja');
    res.set('Content-Type', 'application/pdf');
    res.send(offer.pdfData);
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
        <head><title>AI Ponudbe</title></head>
        <body style="font-family:Arial;text-align:center;padding:50px">
            <h1>🤖 AI Ponudbe</h1>
            <a href="/dashboard.html">📊 Dashboard</a>
        </body>
        </html>
    `);
});

app.get('/dashboard.html', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Dashboard</title>
        <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#4CAF50;color:white}</style>
        </head>
        <body>
            <h1>📊 Ponudbe</h1>
            <table><thead><tr><th>Številka</th><th>Datum</th><th>Podjetje</th><th>Stranka</th><th>Skupaj</th><th>PDF</th></tr></thead><tbody id="tbody"></tbody></table>
            <script>
                fetch('/api/offers').then(r=>r.json()).then(data=>{
                    const tbody = document.getElementById('tbody');
                    data.offers.forEach(o=>{
                        tbody.innerHTML += '<tr><td>'+o.id+'</td><td>'+o.date+'</td><td>'+o.companyName+'</td><td>'+o.customerName+'</td><td>'+o.calculations.total+' €</td><td><a href="/api/offers/'+o.id+'/pdf" target="_blank">PDF</a></td></tr>';
                    });
                });
            </script>
        </body>
        </html>
    `);
});

app.listen(3000, () => console.log('✅ Server na http://localhost:3000'));