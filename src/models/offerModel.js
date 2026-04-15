const { generateOfferNumber } = require('../utils/calculator');

class OfferModel {
  constructor(data) {
    this.id = generateOfferNumber();
    this.date = new Date().toISOString().split('T')[0];
    this.validUntil = data.validUntil || this.addDays(30);
    this.companyName = data.companyName;
    this.companyTaxId = data.companyTaxId;
    this.customerName = data.customerName;
    this.customerEmail = data.customerEmail;
    this.items = data.items;
    this.calculations = data.calculations;
  }
  
  addDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }
  
  toJSON() {
    return {
      id: this.id,
      date: this.date,
      validUntil: this.validUntil,
      companyName: this.companyName,
      companyTaxId: this.companyTaxId,
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      items: this.items,
      calculations: this.calculations
    };
  }
}

module.exports = OfferModel;
