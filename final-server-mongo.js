const express = require('express');
const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
const app = express();
app.use(express.json());

// MONGODB POVEZAVA - PRAVILNO GESLO
const MONGODB_URI = 'mongodb+srv://ai_ponudbe:ponudbe2026@cluster0.lj9uqns.mongodb.net/?retryWrites=true&w=majority';

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

// DOMAČA STRAN - LEP OBRAZEC ZA VNOS
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>AI Ponudbe - Ustvari ponudbo</title>
            <meta charset="UTF-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 40px 20px; }
                .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 20px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
                h1 { color: #667eea; margin-bottom: 10px; text-align: center; }
                .subtitle { color: #666; margin-bottom: 30px; text-align: center; }
                label { font-weight: bold; display: block; margin-top: 15px; margin-bottom: 5px; color: #333; }
                input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; }
                .item-row { display: flex; gap: 10px; margin-bottom: 10px; }
                .item-row input { flex: 1; margin: 0; }
                button { background: #667eea; color: white; padding: 14px 28px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; margin-top: 20px; }
                button:hover { background: #5a67d8; }
                .add-item { background: #4CAF50; margin-top: 10px; }
                .add-item:hover { background: #45a049; }
                .remove-item { background: #f44336; padding: 8px 12px; width: auto; margin-top: 0; }
                .result { margin-top: 20px; padding: 15px; border-radius: 8px; display: none; }
                .success { background: #d4edda; color: #155724; }
                .error { background: #f8d7da; color: #721c24; }
                .dashboard-link { text-align: center; margin-top: 20px; }
                .dashboard-link a { color: #667eea; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 AI Ponudbe</h1>
                <p class="subtitle">Ustvari profesionalno ponudbo v nekaj sekundah</p>
                
                <div id="offerForm">
                    <label>Tvoje podjetje *</label>
                    <input type="text" id="companyName" placeholder="Vpiši ime tvojega podjetja" required>
                    
                    <label>ID za DDV</label>
                    <input type="text" id="companyTaxId" placeholder="npr. SI12345678">
                    
                    <label>Ime stranke *</label>
                    <input type="text" id="customerName" placeholder="Vpiši ime stranke" required>
                    
                    <label>Email stranke</label>
                    <input type="email" id="customerEmail" placeholder="stranka@email.com">
                    
                    <label>Velja do</label>
                    <input type="date" id="validUntil">
                    
                    <h3 style="margin: 20px 0 10px;">📦 Artikli / Storitve</h3>
                    <div id="itemsContainer"></div>
                    <button type="button" class="add-item" onclick="addItem()">+ Dodaj artikel</button>
                    
                    <button onclick="createOffer()">🚀 Ustvari ponudbo</button>
                </div>
                <div id="result" class="result"></div>
                <div class="dashboard-link">
                    <a href="/dashboard.html">📊 Pojdi na Dashboard</a>
                </div>
            </div>

            <script>
                let items = [{ name: '', quantity: 1, unitPrice: 0 }];
                
                function renderItems() {
                    const container = document.getElementById('itemsContainer');
                    container.innerHTML = '';
                    items.forEach((item, index) => {
                        const div = document.createElement('div');
                        div.className = 'item-row';
                        div.innerHTML = \`
                            <input type="text" placeholder="Opis storitve" value="\${item.name}" onchange="updateItem(\${index}, 'name', this.value)">
                            <input type="number" placeholder="Količina" value="\${item.quantity}" onchange="updateItem(\${index}, 'quantity', parseInt(this.value))">
                            <input type="number" placeholder="Cena (€)" value="\${item.unitPrice}" onchange="updateItem(\${index}, 'unitPrice', parseFloat(this.value))">
                            <button class="remove-item" onclick="removeItem(\${index})">✖</button>
                        \`;
                        container.appendChild(div);
                    });
                }
                
                function addItem() {
                    items.push({ name: '', quantity: 1, unitPrice: 0 });
                    renderItems();
                }
                
                function removeItem(index) {
                    items.splice(index, 1);
                    renderItems();
                }
                
                function updateItem(index, field, value) {
                    items[index][field] = value;
                }
                
                async function createOffer() {
                    const companyName = document.getElementById('companyName').value;
                    const customerName = document.getElementById('customerName').value;
                    
                    if (!companyName || !customerName) {
                        alert('Prosim izpolni obvezna polja');
                        return;
                    }
                    
                    const validItems = items.filter(i => i.name && i.quantity > 0 && i.unitPrice > 0);
                    if (validItems.length === 0) {
                        alert('Dodaj vsaj en artikel');
                        return;
                    }
                    
                    const data = {
                        companyName,
                        companyTaxId: document.getElementById('companyTaxId').value,
                        customerName,
                        customerEmail: document.getElementById('customerEmail').value,
                        validUntil: document.getElementById('validUntil').value,
                        items: validItems
                    };
                    
                    const resultDiv = document.getElementById('result');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '⏳ Ustvarjam ponudbo...';
                    resultDiv.className = 'result';
                    
                    try {
                        const response = await fetch('/api/offers/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        const result = await response.json();
                        
                        if (result.success) {
                            resultDiv.innerHTML = \`
                                <div class="success">
                                    <strong>✅ Ponudba ustvarjena!</strong><br>
                                    Številka: \${result.offer.id}<br>
                                    Skupaj: \${result.offer.calculations.total} €<br>
                                    <a href="/api/offers/\${result.offerId}/pdf" target="_blank">📄 Prenesi PDF</a>
                                </div>
                            \`;
                            resultDiv.className = 'result success';
                            
                            document.getElementById('companyName').value = '';
                            document.getElementById('customerName').value = '';
                            document.getElementById('customerEmail').value = '';
                            items = [{ name: '', quantity: 1, unitPrice: 0 }];
                            renderItems();
                        } else {
                            resultDiv.innerHTML = \`<div class="error">❌ Napaka: \${result.error}</div>\`;
                            resultDiv.className = 'result error';
                        }
                    } catch(error) {
                        resultDiv.innerHTML = \`<div class="error">❌ Napaka pri povezavi: \${error.message}</div>\`;
                        resultDiv.className = 'result error';
                    }
                }
                
                renderItems();
            </script>
        </body>
        </html>
    `);
});

// DASHBOARD STRAN
app.get('/dashboard.html', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - AI Ponudbe</title>
            <meta charset="UTF-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; padding: 20px; }
                .container { max-width: 1400px; margin: 0 auto; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
                .header h1 { font-size: 28px; }
                .stats { display: flex; gap: 20px; }
                .stat-card { background: rgba(255,255,255,0.2); padding: 15px 25px; border-radius: 10px; text-align: center; }
                .stat-number { font-size: 32px; font-weight: bold; }
                .controls { background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; display: flex; gap: 15px; flex-wrap: wrap; }
                .search-box { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px; }
                button { background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; }
                .table-container { background: white; border-radius: 12px; overflow-x: auto; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #f8f9fa; padding: 15px; text-align: left; border-bottom: 2px solid #e0e0e0; }
                td { padding: 12px 15px; border-bottom: 1px solid #e0e0e0; }
                .btn-pdf { background: #ff9800; padding: 6px 12px; font-size: 12px; text-decoration: none; color: white; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div><h1>📊 AI Ponudbe - Dashboard</h1><p>Pregled vseh ponudb</p></div>
                    <div class="stats"><div class="stat-card"><div class="stat-number" id="totalOffers">0</div><div>Število ponudb</div></div></div>
                </div>
                <div class="controls">
                    <input type="text" class="search-box" id="searchInput" placeholder="🔍 Išči po številki, podjetju ali stranki...">
                    <button onclick="loadOffers()">🔄 Osveži</button>
                    <button onclick="window.location.href='/'">➕ Nova ponudba</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Številka</th><th>Datum</th><th>Podjetje</th><th>Stranka</th><th>Skupaj (€)</th><th>PDF</th></tr></thead>
                        <tbody id="offersTableBody"><tr><td colspan="6">Nalagam......</td></tr></tbody>
                    </table>
                </div>
            </div>
            <script>
                let allOffers = [];
                async function loadOffers() {
                    const res = await fetch('/api/offers');
                    const data = await res.json();
                    if(data.success) { allOffers = data.offers; renderTable(allOffers); updateStats(); }
                }
                function updateStats() { document.getElementById('totalOffers').innerText = allOffers.length; }
                function renderTable(offers) {
                    const tbody = document.getElementById('offersTableBody');
                    if(offers.length === 0) { tbody.innerHTML = '<tr><td colspan="6">Ni ponudb</td></tr>'; return; }
                    tbody.innerHTML = offers.map(offer => \`
                        <tr>
                            <td>\${offer.id}</td>
                            <td>\${offer.date}</td>
                            <td>\${offer.companyName}</td>
                            <td>\${offer.customerName}</td>
                            <td>\${offer.calculations.total} €</td>    <td><a href="/api/offers/\${offer.id}/pdf" target="_blank" class="btn-pdf">📄 PDF</a></td>
                        </tr>
                    \`).join('');
                }
                document.getElementById('searchInput').addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    renderTable(allOffers.filter(o => o.id.toLowerCase().includes(term) || o.companyName.toLowerCase().includes(term) || o.customerName.toLowerCase().includes(term)));
                });
                loadOffers();
            </script>
        </body>
        </html>
    `);
});

app.listen(3000, () => {
    console.log('✅ Server teče na http://localhost:3000');
    console.log('📁 Dashboard: http://localhost:3000/dashboard.html');
    console.log('📝 Nova ponudba: http://localhost:3000');
});