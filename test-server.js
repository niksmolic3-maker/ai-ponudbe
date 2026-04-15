const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const STORAGE_FILE = 'storage.json';

function saveOffer(offerData) {
    let offers = [];
    if (fs.existsSync(STORAGE_FILE)) {
        offers = JSON.parse(fs.readFileSync(STORAGE_FILE));
    }
    offers.push(offerData);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(offers, null, 2));
}

async function generatePDF(offerData) {
    console.log("Ustvarjam PDF za:", offerData.id);
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Ponudba ${offerData.id}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; border-bottom: 2px solid #4CAF50; padding-bottom: 20px; }
            .company { font-size: 24px; font-weight: bold; color: #4CAF50; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #4CAF50; color: white; }
            .total { text-align: right; font-size: 18px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company">${offerData.companyName}</div>
            <h2>PONUDBA ŠT. ${offerData.id}</h2>
        </div>
        <p><strong>Datum:</strong> ${offerData.date}</p>
        <p><strong>Kupec:</strong> ${offerData.customerName}</p>
        <p><strong>ID za DDV:</strong> ${offerData.companyTaxId || ''}</p>
        <table>
            <tr><th>Opis</th><th>Količina</th><th>Cena/kos</th><th>Skupaj</th></tr>
            ${offerData.items.map(item => `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>${item.unitPrice} €</td>
                    <td>${(item.quantity * item.unitPrice).toFixed(2)} €</td>
                </tr>
            `).join('')}
        </table>
        <div class="total">
            <p>Skupaj brez DDV: ${offerData.calculations.subtotal} €</p>
            <p>DDV (22%): ${offerData.calculations.tax} €</p>
            <p style="font-size: 20px;"><strong>SKUPAJ ZA PLAČILO: ${offerData.calculations.total} €</strong></p>
        </div>
        <hr>
        <p style="font-size: 12px; color: gray;">Ponudba pripravljena z AI sistemom.</p>
    </body>
    </html>
    `;

    try {
        // Ustvari output mapo če ne obstaja
        if (!fs.existsSync('output')) {
            fs.mkdirSync('output');
        }
        
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        const pdfPath = path.join(__dirname, `output/offer_${offerData.id}.pdf`);
        await page.pdf({ 
            path: pdfPath, 
            format: 'A4',
            printBackground: true
        });
        await browser.close();
        
        console.log("PDF ustvarjen:", pdfPath);
        return pdfPath;
    } catch (error) {
        console.error("Napaka pri PDF:", error.message);
        return null;
    }
}

app.post('/api/offers/create', async (req, res) => {
    try {
        console.log("Prejel podatke:", req.body);
        
        const { companyName, companyTaxId, customerName, customerEmail, items } = req.body;
        
        // Izračun
        let subtotal = 0;
        items.forEach(item => {
            subtotal += item.quantity * item.unitPrice;
        });
        const tax = subtotal * 0.22;
        const total = subtotal + tax;
        
        const offerData = {
            id: "P-" + Date.now(),
            date: new Date().toISOString().split('T')[0],
            companyName,
            companyTaxId: companyTaxId || '',
            customerName,
            customerEmail: customerEmail || '',
            items,
            calculations: {
                subtotal: subtotal.toFixed(2),
                tax: tax.toFixed(2),
                total: total.toFixed(2)
            }
        };
        
        // Shrani
        saveOffer(offerData);
        
        // Generiraj PDF
        const pdfPath = await generatePDF(offerData);
        
        res.json({
            success: true,
            message: "Ponudba ustvarjena!",
            offer: offerData,
            pdfPath: pdfPath
        });
        
    } catch (error) {
        console.error("Napaka:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('AI Ponudbe server deluje!');
});

app.listen(3000, () => {
    console.log('✅ Server teče na http://localhost:3000');
    console.log('📁 Output mapa: ' + path.join(__dirname, 'output'));
});