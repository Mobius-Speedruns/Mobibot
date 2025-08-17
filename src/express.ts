// This file is intended to supply mobibot endpoints for local development.
import express from 'express';
import router from './routes/routes';

const app = express();

app.use(express.json());

// Routes
app.use('/', router);

app.listen(3000, () => {
  console.log(`Server running on port ${3000}`);
});
