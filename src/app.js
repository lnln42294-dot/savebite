```javascript
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'savebite_yaounde',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

/**
 * 1. GET /api/bags
 * Récupère les paniers disponibles avec filtrage par quartier de Yaoundé
 * Quartiers attendus : Bastos, Golf, Omnisport, Mokolo, Tsinga, etc.
 */
app.get('/api/bags', async (req, res) => {
  const { neighborhood } = req.query;
  try {
    let query = 'SELECT * FROM bags WHERE status = $1';
    let values = ['available'];

    if (neighborhood) {
      query += ' AND neighborhood = $2';
      values.push(neighborhood);
    }

    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des paniers' });
  }
});

/**
 * 2. POST /api/orders
 * Crée une commande pour un panier anti-gaspillage
 */
app.post('/api/orders', async (req, res) => {
  const { bag_id, customer_name, customer_phone, quantity } = req.body;

  if (!bag_id || !customer_phone) {
    return res.status(400).json({ error: 'Données manquantes' });
  }

  try {
    const query = `
      INSERT INTO orders (bag_id, customer_name, customer_phone, quantity, status, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *
    `;
    const values = [bag_id, customer_name, customer_phone, quantity || 1, 'pending'];
    const result = await pool.query(query, values);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création de la commande' });
  }
});

/**
 * 3. POST /api/payments/webhook
 * Callback pour les notifications de paiement (MTN MoMo / Orange Money)
 */
app.post('/api/payments/webhook', async (req, res) => {
  const { transactionId, externalId, status, amount, currency } = req.body;

  // Note: Dans un cas réel, vérifiez ici la signature/token de sécurité du fournisseur (ex: Campay, Monkap, etc.)
  
  try {
    const orderStatus = status === 'SUCCESSFUL' ? 'paid' : 'failed';
    
    // Mise à jour de la commande basée sur l'ID externe (externalId correspond à notre order_id)
    const updateQuery = 'UPDATE orders SET status = $1, transaction_id = $2 WHERE id = $3 RETURNING *';
    const result = await pool.query(updateQuery, [orderStatus, transactionId, externalId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    // Si payé, on peut aussi décrémenter le stock du panier
    if (orderStatus === 'paid') {
      await pool.query('UPDATE bags SET quantity = quantity - 1 WHERE id = (SELECT bag_id FROM orders WHERE id = $1)', [externalId]);
    }

    res.status(200).json({ message: 'Webhook traité avec succès' });
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(500).json({ error: 'Erreur lors du traitement du paiement' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SaveBite Yaoundé API tournant sur le port ${PORT}`);
});
```