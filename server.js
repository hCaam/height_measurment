const express = require('express');
const mqtt = require('mqtt');
const http = require('http');
const path = require('path');
var mysql = require('mysql2');

const app = express();
const server = http.createServer(app);

const io = require('socket.io')(server);

const mqttOptions = {
  username: 'DATA SISTEM IOT',
  password: 'Datasistemiot123',
};

const db = mysql.createConnection({
  host: 'localhost',
  user: 'your-username',
  password: 'your-password',
  database: 'your_database'
});

const mqttClient = mqtt.connect('mqtts://34e4af2c39f947029e4d6ac853af4421.s2.eu.hivemq.cloud:8883/', mqttOptions);

db.connect(err => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

app.get('/api/users', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
      if (err) {
          console.error('Error fetching data:', err);
          return res.status(500).send('Server Error');
      }
      res.json(results);
  });
});

mqttClient.on('message', (topic, message) => {
  const data = String.fromCharCode.apply(null, message);

  const timestamp = new Date();
  const query = 'INSERT INTO water_height (data, timestamp) VALUES (?, ?)';
  db.query(query, [data, timestamp], (err, results) => {
    if (err) {
      console.error('Error inserting data into MySQL:', err);
    } else {
      console.log('Data inserted into MySQL:', results);
    }
  });

  io.emit('mqttData', data);
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