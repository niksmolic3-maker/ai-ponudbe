const { calculateOffer } = require('../utils/calculator');
const OfferModel = require('../models/offerModel');
const fs = require('fs').promises;
const puppeteer = require('puppeteer');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, '../../storage.json');

async function saveOffer(offerData) {
  try {
    let offers = [];
    try {
      const data = await fs.readFile(STORAGE_FILE, 'utf8');
      offers = JSON.parse(data);
    } catch (err) {
      // Datoteka ne obstaja
    }
    offers.push(offerData);
    await fs.writeFile(STORAGE_FILE, JSON.stringify(offers, null, 2));
    return true;
  } catch (err) {
    console.error('Napaka pri shranjevanju:', err);
    return false;
  }
}

async function generatePDF(offerData) {
  const templatePath = path.join(__dirname, '../templates/offerTemplate.html');
  
  // Preveri, če template obstaja
  try {
    await fs.access(templatePath);
  } catch (err) {
    console.error('Template ne obstaja:', templatePath);
    return null;
  }
  
  let htmlTemplate = await fs.readFile(templatePath, 'utf8');
  
  // Ustvari HTML tabelo
  let itemsHtml = '<table border="1" style="width:100%; border-collapse: collapse;">';
  itemsHtml += '<tr><th>Opis</th><th>Količina</th><th>Cena/kos</th><th>Skupaj</th></tr>';
  
  offerData.items.forEach(item => {
    const skupaj = item.quantity * item.unitPrice;
    itemsHtml += `<tr>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>${item.unitPrice} €</td>
      <td>${skupaj.toFixed(2)} €</td>
    </tr>`;
  });
  itemsHtml += '</table>';
  
  // Zamenjaj placeholderje
  htmlTemplate = htmlTemplate
    .replace('{{offerId}}', offerData.id)
    .replace('{{date}}', offerData.date)
    .replace('{{validUntil}}', offerData.validUntil)
    .replace('{{companyName}}', offerData.companyName)
    .replace('{{companyTaxId}}', offerData.companyTaxId || '')
    .replace('{{customerName}}', offerData.customerName)
    .replace('{{itemsTable}}', itemsHtml)
    .replace('{{subtotal}}', offerData.calculations.subtotal)
    .replace('{{tax}}', offerData.calculations.tax)
    .replace('{{taxRate}}', offerData.calculations.taxRate)
    .replace('{{total}}', offerData.calculations.total);
  
  // Ustvari PDF
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
  
  const pdfPath = path.join(__dirname, `../../output/offer_${offerData.id}.pdf`);
  await page.pdf({ 
    path: pdfPath, 
    format: 'A4',
    printBackground: true
  });
  await browser.close();
  
  return pdfPath;
}

async function createOffer(req, res) {
  try {
    console.log("Prejet zahtevek:", req.body);
    
    const { companyName, companyTaxId, customerName, customerEmail, items, validUntil } = req.body;
    
    // Validacija
    if (!companyName || !customerName || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Manjkajo obvezni podatki (companyName, customerName, items)' 
      });
    }
    
    // Izračunaj cene
    const calculations = calculateOffer(items);
    
    // Ustvari ponudbo
    const offer = new OfferModel({
      companyName,
      companyTaxId: companyTaxId || '',
      customerName,
      customerEmail: customerEmail || '',
      items,
      calculations,
      validUntil
    });
    
    const offerData = offer.toJSON();
    
    // Shrani
    await saveOffer(offerData);
    
    // Generiraj PDF
    const pdfPath = await generatePDF(offerData);
    
    res.status(201).json({
      success: true,
      message: 'Ponudba uspešno ustvarjena!',
      offer: offerData,
      pdfPath: pdfPath
    });
    
  } catch (err) {
    console.error('Napaka v createOffer:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      stack: err.stack 
    });
  }
}

module.exports = { createOffer };