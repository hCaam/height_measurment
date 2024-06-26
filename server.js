require('dotenv').config();
const express = require('express');
const mqtt = require('mqtt');
const http = require('http');
const path = require('path');
var mysql = require('mysql2');
const cron = require('node-cron');

const app = express();
const server = http.createServer(app);

const io = require('socket.io')(server);

const mqttOptions = {
  username: 'DATA SISTEM IOT',
  password: 'Datasistemiot123',
};

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const mqttClient = mqtt.connect('mqtts://34e4af2c39f947029e4d6ac853af4421.s2.eu.hivemq.cloud:8883/', mqttOptions);

//Dummy data
const generateRandomData = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Function to insert dummy data
const insertDummyData = () => {
  const dataPoints = 7; // Number of days
  const query = 'INSERT INTO water_height (data, timestamp) VALUES (?, ?)';
  const today = new Date();

  for (let i = 0; i <= dataPoints; i++) {
    const data = generateRandomData(500, 900);
    const timestamp = new Date(today);
    timestamp.setDate(today.getDate() - i);

    db.query(query, [data, timestamp], (err, results) => {
      if (err) {
        console.error('Error inserting dummy data into MySQL:', err);
      } else {
        console.log(`Dummy data inserted for ${timestamp.toISOString()}:`, results);
      }
    });
  }
};


db.connect(err => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');

  const checkTableQuery = `SHOW TABLES LIKE 'water_height'`;

  db.query(checkTableQuery, (err, results) => {
    if (err) {
      console.error('Error checking for table:', err);
      return;
    }

    if (results.length === 0) {
      // Tabel water_height belum ada, buat tabel terlebih dahulu
      const createTableQuery = `
        CREATE TABLE water_height (
          id INT AUTO_INCREMENT PRIMARY KEY,
          data FLOAT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      db.query(createTableQuery, (err, results) => {
        if (err) {
          console.error('Error creating table:', err);
          return;
        }
        console.log('Table created:', results);
        insertDummyData(); // Setelah membuat tabel, baru masukkan dummy data
      });
    }
  });
});


app.get('/api/users', (req, res) => {
  db.query('SELECT * FROM water_height', (err, results) => {
      if (err) {
          console.error('Error fetching data:', err);
          return res.status(500).send('Server Error');
      }
      res.json(results);
  });
});

let dailyData = [];
mqttClient.on('message', (topic, message) => {
  const data = String.fromCharCode.apply(null, message);

  if (!isNaN(data)) {
    dailyData.push(data); // Store the data in the array
  }

  io.emit('mqttData', data);
});

cron.schedule('0 0 * * *', () => { // This cron job runs every day at midnight
  if (dailyData.length > 0) {
    const sum = dailyData.reduce((a, b) => a + b, 0);
    const average = sum / dailyData.length;
    const timestamp = new Date();
    const query = 'INSERT INTO water_height (data, timestamp) VALUES (?, ?)';

    db.query(query, [average, timestamp], (err, results) => {
      if (err) {
        console.error('Error inserting data into MySQL:', err);
      } else {
        console.log('Average data inserted into MySQL:', results);
      }
    });

    // Clear the dailyData array for the next day
    dailyData = [];
  }
});

mqttClient.on('connect', () => {
  console.log('Connected to MQTT!');
  mqttClient.subscribe('esp8266_data');
});

mqttClient.on('error', (error) => {
  console.log('MQTT Error:', error);
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Set up socket.io connection
io.on('connection', (socket) => {
  console.log('Socket.io connected');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
