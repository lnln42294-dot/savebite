const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Simulation de base de données
let baskets = [
    { id: 1, shopName: "Boulangerie du Palais", items: "Viennoiseries", price: 2500, neighborhood: "Bastos", stock: 5 },
    { id: 2, shopName: "Supermarché Golf", items: "Fruits et Légumes", price: 3000, neighborhood: "Golf", stock: 3 },
    { id: 3, shopName: "Resto Omnisport", items: "Plats cuisinés", price: 2000, neighborhood: "Omnisport", stock: 8 },
    { id: 4, shopName: "Casino Bastos", items: "Produits laitiers", price: 4000, neighborhood: "Bastos", stock: 2 }
];

let orders = [];

// 1. Lister les paniers par quartier
app.get('/api/baskets/:neighborhood', (req, res) => {
    const neighborhood = req.params.neighborhood.toLowerCase();
    const filteredBaskets = baskets.filter(b => b.neighborhood.toLowerCase() === neighborhood);
    
    if (filteredBaskets.length === 0) {
        return res.status(404).json({ message: "Aucun panier trouvé dans ce quartier." });
    }
    
    res.json(filteredBaskets);
});

// 2. Créer une commande
app.post('/api/orders', (req, res) => {
    const { basketId, customerPhone, customerName, paymentMethod } = req.body;

    const basket = baskets.find(b => b.id === basketId);
    if (!basket || basket.stock <= 0) {
        return res.status(400).json({ error: "Panier non disponible ou épuisé." });
    }

    const newOrder = {
        id: `ORD-${Date.now()}`,
        basketId,
        customerPhone,
        customerName,
        paymentMethod, // 'MTN' ou 'ORANGE'
        amount: basket.price,
        status: 'PENDING_PAYMENT',
        createdAt: new Date()
    };

    orders.push(newOrder);
    basket.stock -= 1;

    // Simulation d'initialisation de paiement vers un agrégateur (ex: CinetPay, MonCash, Maviance)
    res.status(201).json({
        message: "Commande créée, en attente de paiement.",
        orderId: newOrder.id,
        paymentInstructions: `Veuillez valider le prompt sur votre téléphone ${customerPhone}`
    });
});

// 3. Webhook de confirmation de paiement (MTN MoMo / Orange Money)
app.post('/api/webhooks/payment', (req, res) => {
    const { status, transaction_id, external_reference, operator } = req.body;

    // external_reference correspondrait à notre orderId
    const orderIndex = orders.findIndex(o => o.id === external_reference);

    if (orderIndex !== -1) {
        if (status === 'SUCCESSFUL' || status === 'ACCEPTED') {
            orders[orderIndex].status = 'PAID';
            orders[orderIndex].transactionId = transaction_id;
            console.log(`Paiement confirmé pour la commande ${external_reference} via ${operator}`);
        } else {
            orders[orderIndex].status = 'FAILED';
            // Replacer le stock si échec
            const basket = baskets.find(b => b.id === orders[orderIndex].basketId);
            if (basket) basket.stock += 1;
        }
        
        return res.status(200).send('Webhook processed');
    }

    res.status(404).send('Order not found');
});

app.listen(port, () => {
    console.log(`SaveBite API running on port ${port}`);
});