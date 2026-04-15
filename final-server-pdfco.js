const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const STORAGE_FILE = 'storage.json';
const PDFCO_API_KEY = 'nik.smolic3@gmail.com_ku4H9NZ5YyXQKpTaYtJ2kopeuVCfdjbxSVQUjrZlWC2ULnoQn0J9BYWTWQuOeZBH'; // ← ZAMENJAJ S PRAVIM KLJUČEM!

// Shranjevanje ponudb
function saveOffer(offerData) {
    let offers = [];
    if (fs.existsSync(STORAGE_FILE)) {
        offers = JSON.parse(fs.readFileSync(STORAGE_FILE));
    }
    offers.push(offerData);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(offers, null, 2));
}

// Generiranje PDF preko PDF.co API
async function generatePDF(offerData) {
    // Ustvari HTML za ponudbo
    const html = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Ponudba ${offerData.id}</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; }
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
        ${offerData.items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.unitPrice}</td><td>${(i.quantity * i.unitPrice).toFixed(2)} €</td></tr>`).join('')}
        </table>
        <div class="total">Skupaj za plačilo: ${offerData.calculations.total} €</div>
    </body>
    </html>`;

    // Pošlji zahtevek na PDF.co API
    const response = await fetch('https://api.pdf.co/v1/pdf/convert/from/html', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': PDFCO_API_KEY
        },
        body: JSON.stringify({
            html: html,
            name: `ponudba_${offerData.id}`,
            margins: '20px 20px 20px 20px',
            paperSize: 'A4',
            printBackground: true
        })
    });

    const result = await response.json();
    
    if (!result.url) {
        throw new Error('PDF.co napaka: ' + (result.error || 'Neznana napaka'));
    }
    
    // Prenesi PDF iz URL-ja
    const pdfResponse = await fetch(result.url);
    const pdfBuffer = await pdfResponse.buffer();
    
    return pdfBuffer;
}

// API endpoint za ustvarjanje ponudbe
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
        
        // Generiraj PDF preko PDF.co
        const pdfBuffer = await generatePDF(offerData);
        
        // Shrani ponudbo in PDF
        saveOffer(offerData);
        
        // Shrani PDF v mapo output
        if (!fs.existsSync('output')) fs.mkdirSync('output');
        const pdfPath = `output/ponudba_${offerData.id}.pdf`;
        fs.writeFileSync(pdfPath, pdfBuffer);
        
        res.json({
            success: true,
            message: "Ponudba uspešno ustvarjena!",
            offer: offerData,
            downloadUrl: `/${pdfPath}`
        });
        
    } catch (error) {
        console.error('Napaka:', error);
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

// Domov - lep obrazec
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
                
                function addItem() { items.push({ name: '', quantity: 1, unitPrice: 0 }); renderItems(); }
                function removeItem(index) { items.splice(index, 1); renderItems(); }
                function updateItem(index, field, value) { items[index][field] = value; }
                
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
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Dashboard - AI Ponudbe</title>
        <style>
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
                    tbody.innerHTML += \`<tr><td>\${offer.id}</td><td>\${offer.date}</td><td>\${offer.companyName}</td><td>\${offer.customerName}</td><td>\${offer.calculations.total} €</td><td><a href="/output/ponudba_\${offer.id}.pdf" target="_blank" class="btn-pdf">📄 PDF</a></td></tr>\`;
                });
            });
        </script>
        </body></html>
    `);
});

app.listen(3000, () => {
    console.log('✅ Server teče na http://localhost:3000');
});