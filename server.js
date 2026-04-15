const express = require('express');
const fs = require('fs');
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

app.post('/api/offers/create', async (req, res) => {
    try {
        const { companyName, companyTaxId, customerName, customerEmail, items } = req.body;
        
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
        
        saveOffer(offerData);
        
        res.json({
            success: true,
            message: "Ponudba ustvarjena!",
            offer: offerData
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/offers', (req, res) => {
    if (fs.existsSync(STORAGE_FILE)) {
        const offers = JSON.parse(fs.readFileSync(STORAGE_FILE));
        res.json({ success: true, offers });
    } else {
        res.json({ success: true, offers: [] });
    }
});

app.get('/', (req, res) => {
    res.send('AI Ponudbe server deluje! 🚀');
});

app.listen(3000, () => {
    console.log('✅ Server teče na http://localhost:3000');
});