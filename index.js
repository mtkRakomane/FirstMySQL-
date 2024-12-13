const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const mysql = require('mysql2/promise');
const session = require('express-session');
const app = express();
// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(
  session({
    secret: 'hhhwjhhbdebcibnreyhbyfbahnybrfbhbyreyrybvcbklrfeigf))ew',
    resave: false,
    saveUninitialized: true,
  })
);
// Database connection
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'quantity',
};
let db;
(async () => {
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL');
  } catch (error) {
    console.error('Error connecting to MySQL:', error);
  }
})();
// Helper function for executing queries
const executeQuery = async (query, params = []) => {
  try {
    const [results] = await db.execute(query, params);
    return results;
  } catch (error) {
    console.error('Error executing query:', query, params, error);
    throw error;
  }
};
// Middleware to check if user is logged in
const ensureAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
};
// Routes
app.get('/', async (req, res) => {
  try {
    const salePeoples = await executeQuery('SELECT saleName FROM salePeople');
    res.render('login', { salePeoples });
  } catch (error) {
    res.status(500).send('Error fetching salePeople');
  }
});
app.post('/login', async (req, res) => {
  const { ref_num, saleName } = req.body;

  try {
    const results = await executeQuery('SELECT * FROM Users WHERE ref_num = ? AND saleName = ?', [ref_num, saleName]);

    if (results.length === 0) {
      return res.send('User not found');
    }

    // Store user details in session
    req.session.user = results[0];

    res.redirect('/home');
  } catch (error) {
    res.status(500).send('Error logging in');
  }
});
app.get('/signup', async (req, res) => {
  try {
    const [salePeoples, installDifficultyTypes, slaMlaTypes, validateNumTypes, productTypes, supplyTypes] = await Promise.all([
      executeQuery('SELECT saleName FROM salePeople'),
      executeQuery('SELECT install_difficulty FROM InstallDifficultyType'),
      executeQuery('SELECT sla_mla FROM SlaMlaType'),
      executeQuery('SELECT validate_num_days FROM ValidateNumType'),
      executeQuery('SELECT Description FROM ProductType'),
      executeQuery('SELECT supplier FROM SupplyType'),
    ]);
    res.render('signup', { salePeoples, installDifficultyTypes, slaMlaTypes, validateNumTypes, productTypes, supplyTypes });
  } catch (error) {
    res.status(500).send('Error fetching data for signup');
  }
});
app.post('/signup', async (req, res) => {
  const { ref_num, saleName, email, cell, role, customer_name, customer_call_person, customer_email } = req.body;

  try {
    const existingUser = await executeQuery('SELECT * FROM Users WHERE ref_num = ?', [ref_num]);

    if (existingUser.length > 0) {
      return res.status(400).send('Reference already exists.');
    }

    await executeQuery(
      'INSERT INTO Users (ref_num, saleName, email, cell, role, customer_name, customer_call_person, customer_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [ref_num, saleName, email, cell, role, customer_name, customer_call_person, customer_email]
    );

    console.log('User registered successfully');
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error registering user');
  }
});
app.get('/home', ensureAuthenticated, async (req, res) => {
  try {
    const userRefNum = req.session.user?.ref_num;

    if (!userRefNum) {
      return res.redirect('/'); // Redirect to login if user not authenticated
    }

    const user = await executeQuery('SELECT * FROM Users WHERE ref_num = ?', [userRefNum]);

    if (user.length === 0) {
      return res.status(404).send('User not found');
    }

    const billings = await executeQuery('SELECT * FROM Billing WHERE ref_num = ?', [userRefNum]);

    res.render('home', { user: user[0], billings });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error retrieving user data');
  }
});
app.get('/add-billing', ensureAuthenticated, async (req, res) => {
  const user = req.session.user;
  res.render('add-billing', { user });
});
app.post('/add-billing', ensureAuthenticated, async (req, res) => {
  const {
    ref_num, bill_title,
    descriptions, install_difficulty, factor, sla_mla, maintain_visit,
    validate_num_days, stock_code, stock_qty, unit_cost, product_type,
    equip_margin, labour_margin, labour_hrs, maintenance_hrs, supplier
  } = req.body;

  try {
    const [existingRefNum] = await executeQuery(
      `SELECT 1 FROM Users WHERE ref_num = ? LIMIT 1`,
      [ref_num]
    );

    if (!existingRefNum) {
      return res.status(400).send('Invalid Reference entered!. Please enter correct Reference!.');
    }

    await executeQuery(
      `INSERT INTO Billing (
        ref_num, bill_title, descriptions, install_difficulty, factor, sla_mla, maintain_visit,
        validate_num_days, stock_code, stock_qty, unit_cost, product_type,
        equip_margin, labour_margin, labour_hrs, maintenance_hrs, supplier
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.user.ref_num, bill_title || null, descriptions || null, install_difficulty || null,
        factor || null, sla_mla || null, maintain_visit || null, validate_num_days || null,
        stock_code || null, stock_qty || null, unit_cost || null, product_type || null,
        equip_margin || null, labour_margin || null, labour_hrs || null, maintenance_hrs || null,
        supplier || null
      ]
    );

    console.log('Billing data added successfully');
    res.redirect('/home');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error adding billing data');
  }
});
app.post('/delete-billing', async (req, res) => {
  const { billing_id } = req.body;

  try {
    await executeQuery('DELETE FROM Billing WHERE id = ?', [billing_id]);
    console.log(`Billing entry with ID ${billing_id} deleted successfully`);
    res.redirect('/home'); // Redirect back to home after deletion
  } catch (error) {
    console.error(error);
    res.status(500).send('Error deleting billing entry');
  }
});
// Start server
const PORT = 1530;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
