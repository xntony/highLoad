require('dotenv').config();
const express = require('express');
const app = express();
const { Sequelize } = require('sequelize');
const sequelize = require('./config/database');
const User = require('./models/user');

// Middleware
app.use(express.json());

// GET all users
app.get('/users', async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /users/:id/balance — update balance (increase or decrease)
app.put('/users/:id/balance', async (req, res) => {
  const transaction = await sequelize.transaction({
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
  });

  try {
    const userId = parseInt(req.params.id, 10);
    const amount = parseFloat(req.body.amount);

    // Input validation
    if (isNaN(userId) || isNaN(amount)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid userId or amount' });
    }

    // Lock the row on READ to block concurrent conflicting transactions
    const user = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const newBalance = user.balance + amount;

    // Rollback first, then return error
    if (newBalance < 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    await user.update({ balance: newBalance }, { transaction });
    await transaction.commit();

    console.log(`Balance updated for user ${userId}: ${newBalance}`);
    res.status(200).json({ message: 'Balance updated successfully', balance: newBalance });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reset — reset user 1 balance to 10000 (testing only)
app.get('/reset', async (req, res) => {
  try {
    const user = await User.findByPk(1);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ balance: 10000 });
    res.status(200).json({ message: 'Balance reset to 10000', balance: 10000 });
  } catch (error) {
    console.error('Error resetting balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware — must be AFTER all routes
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => console.error('Unable to connect to the database:', err));