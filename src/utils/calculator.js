function calculateOffer(items, taxRate = 0.22) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      subtotal: 0,
      tax: 0,
      taxRate: taxRate * 100,
      total: 0
    };
  }

  const subtotal = items.reduce((sum, item) => {
    const price = parseFloat(item.unitPrice) || 0;
    const quantity = parseInt(item.quantity) || 0;
    return sum + (price * quantity);
  }, 0);
  
  const tax = subtotal * taxRate;
  const total = subtotal + tax;
  
  return {
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    taxRate: taxRate * 100,
    total: total.toFixed(2)
  };
}

function generateOfferNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000);
  return `P-${year}${month}${day}-${random}`;
}

module.exports = { calculateOffer, generateOfferNumber };