const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use('/output', express.static('output')); // OMOGOČI DOSTOP DO PDF-jev

// Ustvari output mapo če ne obstaja
if (!fs.existsSync('output')) {
    fs.mkdirSync('output');
    console.log("📁 Ustvarjena output mapa");
}

// Shranjevanje ponudb
const STORAGE_FILE = 'storage.json';

function saveOffer(offerData) {
    let offers = [];
    if (fs.existsSync(STORAGE_FILE)) {
        offers = JSON.parse(fs.readFileSync(STORAGE_FILE));
    }
    offers.push(offerData);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(offers, null, 2));
    console.log("💾 Ponudba shranjena v storage.json");
}

// Generiranje PDF
async function generatePDF(offerData) {
    console.log("📄 Začenjam generiranje PDF za:", offerData.id);
    
    const html = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Ponudba ${offerData.id}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 40px; }
            .invoice { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .company { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
            .title { font-size: 20px; opacity: 0.9; }
            .content { padding: 30px; }
            .info { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
            .info-box p { margin: 5px 0; color: #555; }
            .info-box strong { color: #333; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #667eea; color: white; padding: 12px; text-align: left; }
            td { padding: 12px; border-bottom: 1px solid #e0e0e0; color: #555; }
            .totals { text-align: right; margin-top: 20px; padding-top: 20px; border-top: 2px solid #e0e0e0; }
            .total-row { margin: 10px 0; font-size: 16px; }
            .grand-total { font-size: 24px; font-weight: bold; color: #667eea; margin-top: 15px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #888; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="invoice">
            <div class="header">
                <div class="company">${offerData.companyName}</div>
                <div class="title">PONUDBA ŠT. ${offerData.id}</div>
            </div>
            <div class="content">
                <div class="info">
                    <div class="info-box">
                        <p><strong>Datum:</strong> ${offerData.date}</p>
                        <p><strong>Velja do:</strong> ${offerData.validUntil}</p>
                        <p><strong>ID za DDV:</strong> ${offerData.companyTaxId || 'NI VNOSA'}</p>
                    </div>
                    <div class="info-box">
                        <p><strong>Kupec:</strong> ${offerData.customerName}</p>
                        <p><strong>Email:</strong> ${offerData.customerEmail || 'NI VNOSA'}</p>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr><th>Opis storitve</th><th>Količina</th><th>Cena (€)</th><th>Skupaj (€)</th></tr>
                    </thead>
                    <tbody>
                        ${offerData.items.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                                <td>${Number(item.unitPrice).toFixed(2)}</td>
                                <td>${(item.quantity * item.unitPrice).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="totals">
                    <div class="total-row">Skupaj brez DDV: ${offerData.calculations.subtotal} €</div>
                    <div class="total-row">DDV (22%): ${offerData.calculations.tax} €</div>
                    <div class="grand-total">SKUPAJ ZA PLAČILO: ${offerData.calculations.total} €</div>
                </div>
            </div>
            <div class="footer">
                <p>Hvala za zaupanje! Ponudba je pripravljena z AI sistemom.</p>
                <p>${offerData.companyName}</p>
            </div>
        </div>
    </body>
    </html>`;

    try {
        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        const pdfPath = path.join(__dirname, `output/ponudba_${offerData.id}.pdf`);
        await page.pdf({ 
            path: pdfPath, 
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
        });
        await browser.close();
        
        console.log("✅ PDF ustvarjen:", pdfPath);
        return pdfPath;
    } catch (error) {
        console.error("❌ Napaka pri PDF:", error.message);
        return null;
    }
}

// API endpoint za ustvarjanje ponudbe
app.post('/api/offers/create', async (req, res) => {
    try {
        console.log("📥 Prejel podatke:", req.body);
        
        const { companyName, companyTaxId, customerName, customerEmail, items, validUntil } = req.body;
        
        if (!companyName || !customerName || !items || items.length === 0) {
            return res.status(400).json({ success: false, error: "Manjkajo obvezni podatki" });
        }
        
        let subtotal = 0;
        items.forEach(item => {
            subtotal += item.quantity * item.unitPrice;
        });
        const tax = subtotal * 0.22;
        const total = subtotal + tax;
        
        const validUntilDate = validUntil || (() => {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            return d.toISOString().split('T')[0];
        })();
        
        const offerData = {
            id: "P-" + Date.now(),
            date: new Date().toISOString().split('T')[0],
            validUntil: validUntilDate,
            companyName,
            companyTaxId: companyTaxId || '',
            customerName,
            customerEmail: customerEmail || '',
            items: items.map(item => ({
                name: item.name,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice)
            })),
            calculations: {
                subtotal: subtotal.toFixed(2),
                tax: tax.toFixed(2),
                total: total.toFixed(2)
            }
        };
        
        saveOffer(offerData);
        const pdfPath = await generatePDF(offerData);
        
        res.json({
            success: true,
            message: "Ponudba uspešno ustvarjena!",
            offer: offerData,
            pdfPath: pdfPath,
            downloadUrl: pdfPath ? `/output/ponudba_${offerData.id}.pdf` : null
        });
        
    } catch (error) {
        console.error("❌ Napaka:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint za vse ponudbe
app.get('/api/offers', (req, res) => {
    if (fs.existsSync(STORAGE_FILE)) {
        const offers = JSON.parse(fs.readFileSync(STORAGE_FILE));
        res.json({ success: true, offers });
    } else {
        res.json({ success: true, offers: [] });
    }
});

// Izbriši ponudbo
app.delete('/api/offers/:id', (req, res) => {
    try {
        const offerId = req.params.id;
        
        if (!fs.existsSync(STORAGE_FILE)) {
            return res.status(404).json({ success: false, error: 'Ni ponudb' });
        }
        
        let offers = JSON.parse(fs.readFileSync(STORAGE_FILE));
        const filteredOffers = offers.filter(o => o.id !== offerId);
        
        if (offers.length === filteredOffers.length) {
            return res.status(404).json({ success: false, error: 'Ponudba ne obstaja' });
        }
        
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(filteredOffers, null, 2));
        
        const pdfPath = path.join(__dirname, `output/ponudba_${offerId}.pdf`);
        if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
        }
        
        res.json({ success: true, message: 'Ponudba izbrisana' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Domov - spletni vmesnik
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
                h1 { color: #667eea; margin-bottom: 10px; }
                .subtitle { color: #666; margin-bottom: 30px; }
                input, textarea { width: 100%; padding: 12px; margin: 8px 0 20px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; }
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
                    <input type="text" id="companyName" placeholder="Tvoje podjetje *" required>
                    <input type="text" id="companyTaxId" placeholder="ID za DDV (npr. SI12345678)">
                    <input type="text" id="customerName" placeholder="Ime stranke *" required>
                    <input type="email" id="customerEmail" placeholder="Email stranke">
                    <input type="date" id="validUntil" placeholder="Velja do">
                    
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
                                    <a href="\${result.downloadUrl}" target="_blank">📄 Prenesi PDF</a>
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

// Dashboard stran
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Zaženi strežnik
app.listen(3000, () => {
    console.log('✅ Server teče na http://localhost:3000');
    console.log('📁 Dashboard: http://localhost:3000/dashboard.html');
    console.log('📝 Nova ponudba: http://localhost:3000');
});