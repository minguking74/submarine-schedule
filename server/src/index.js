import app from './app.js';

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SJC2 Capacity Schedule API listening on http://localhost:${PORT}`);
});
