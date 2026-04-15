const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const offerRoutes = require('./src/routes/offerRoutes');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/offers', offerRoutes);

app.get('/', (req, res) => {
  res.send('AI Ponudbe server deluje! 🚀');
});

app.listen(PORT, () => {
  console.log(`✅ Server teče na http://localhost:${PORT}`);
  console.log(`📝 Testni endpoint: http://localhost:${PORT}/api/offers/create`);
});
