import express from 'express';
const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
  res.send('✅ Hello from test server!');
});

app.listen(PORT, '::', () => {
  console.log(`Server running on IPv6 at http://[::]:${PORT}`);
});