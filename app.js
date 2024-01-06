const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io')
const http = require('http')
const qrcode = require('qrcode');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');



const port = process.env.PORT || 8000;


const app = express();



const server = http.createServer(app);
const io = socketIO(server);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true}));


app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

app.get('/token', (req, res) => {
  res.sendFile('token.html', { root: __dirname });
});

// Simpan data terakhir dari API
let lastData = [];


const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
      ],
    },
    authStrategy: new LocalAuth()
  });


client.on('message', async msg => {
    console.log(`Message received from ${msg.from}: ${msg.body}`);
    if (msg.body == '!ping') {
        msg.reply('pong');
    }


    if (msg.body.startsWith('!sticker') && msg.type == 'image'){
        const media = await msg.downloadMedia();
        client.sendMessage(msg.from, media, {
            sendMediaAsSticker: true,
        });
    }

    if (msg.body === '!tugas') {
      try {
        const response = await axios.get('https://apivclass.herokuapp.com/upcoming');
        const data = response.data;
        let message = '';
        const now = new Date();
        message += `Update tugas pada tanggal ${now.toLocaleDateString()} pukul ${now.toLocaleTimeString()}\n\n`;
        data.forEach(tugas => {
          message += `📝 *${tugas.name}*\n📅 Deadline: ${tugas.date}\n🔗 Link: ${tugas.link}\n\n`;
        });
        await msg.reply(message);
      } catch (error) {
        console.error(error);
        await msg.reply('Terjadi kesalahan saat memuat data tugas.');
      }
    }
      
    

    if (msg.body === '!1ka28') {
        try {
          const response = await axios.get('https://1ka28.000webhostapp.com/jadwalmatkul.php');
          
          // Rapihkan data jadwal kuliah dan ubah format hari menjadi 'jum'at'
          const formattedData = response.data.map(row => {
            const [kode, hari, namaMatkul, jam, ruangan, dosen] = row;
            const formattedHari = hari.replace(/&#039;/g, "'");
            return `Mata Kuliah: ${namaMatkul}\nDosen: ${dosen}\nRuangan: ${ruangan}\nWaktu: ${formattedHari} ${jam}\n\n`;
          }).join('');
      
          // Kirim data API ke pengguna
          const message = `Jadwal kuliah:\n${formattedData}`;
          msg.reply(message);
        } catch (error) {
          console.error(error);
          msg.reply('Terjadi kesalahan saat memuat jadwal kuliah.');
        }
      } 


      if (msg.body === '/loker') {
        try {
          const response = await axios.get('https://api-loker-production.up.railway.app/loker');
          
          const data = response.data;
          let message = '----------------------------------------\n';
          
          data.forEach(loker => {
            message += `📝 *${loker.title}*\n📅 tanggal: ${loker.date}\n🔗 Link: ${loker.detailsUrl}\n\n`;
        });

          msg.reply(message);
        } catch (error) {
          console.error(error);
          msg.reply('Terjadi kesalahan saat memuat loker.');
        }
      } 

      
  
});




client.initialize();

// socket io

io.on('connection', function(socket){

    socket.emit('message', 'Conneting...');
    
    client.on('qr', (qr) => {
        // Generate and scan this code with your phone
        console.log('QR RECEIVED', qr , {small: true});
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit('qr', url);
            socket.emit('message', 'QR Code received, scan please');
            });
        });

        client.on('ready', () => {
          socket.emit('ready', 'Whatsapp is ready');
          socket.emit('message', 'Whatsapp is ready');
          const chatId = '628872588744@c.us'; // Ganti dengan nomor WhatsApp 
          let lastMessage = '';
        
          // Set interval untuk polling data dan mengirim pesan jika ada data terbaru
          // setInterval(() => {
          //   sendNotificationIfNewData(chatId, lastMessage);
          // }, 60000);
        });


        // Fungsi untuk mengirim pesan ke nomor tertentu jika ada data terbaru
// const sendNotificationIfNewData = async (chatId, lastMessage) => {
//   try {
//     const response = await axios.get('https://api-loker-production.up.railway.app/loker');
//     const newData = response.data;

//     if (JSON.stringify(newData) !== lastMessage) {
//       lastMessage = JSON.stringify(newData);
//       let message = 'Bot melihat ada loker terbaru\n\n';
//       newData.forEach(loker => {
//         message += `📝 *${loker.title}*\n📅 tanggal: ${loker.date}\n🔗 Link: ${loker.detailsUrl}\n\n`;
//       });

//       client.sendMessage(chatId, message);
//     }
//   } catch (error) {
//     console.error('Failed to fetch data from API endpoint:', error);
//   }
// };

    client.on('authenticated', () => {
        socket.emit('authenticated', 'Whatsapp is authenticated');
        socket.emit('message', 'Whatsapp is authenticated');
        console.log('AUTHENTICATED');
    });

    client.on('auth_failure', msg => {
        // Fired if session restore was unsuccessful
        socket.emit('auth_failure', 'Whatsapp is AUTHENTICATION FAILURE');
        socket.emit('message', 'Whatsapp is AUTHENTICATION FAILURE');
        console.error('AUTHENTICATION FAILURE', msg);

    });

});

app.post('/send-message', [
    body('number').notEmpty(),
    body('message').notEmpty(),
], verifyToken, (req, res) => {
    const errors = validationResult(req).formatWith(({ msg }) => {
        return msg;
    });
    if (!errors.isEmpty()) {
        return res.status(422).json({
            status: false,
            message: errors.mapped()
        })
    }
    const number = req.body.number;
    const message = req.body.message;
    client.sendMessage(number, message).then(response => {
        res.status(200).json({
            status: true,
            response: response
        });
    }).catch(err => {
        res.status(500).json({
            status: false,
            response: err
        });
    });
});


app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Perform authentication logic here, e.g. check if username and password are valid
    if (username !== 'admin' || password !== 'AdminAmmar') {
    return res.status(401).json({ message: 'Invalid username or password' });
    }
    // Your existing login code goes here
    const user = { id: 1, username: 'ammar' };
    const token = jwt.sign({ user }, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFtbWFyIEFyaWVmIiwiaWF0IjoxNTE2MjM5MDIyfQ.tAMImjGRibpUGRWpuCJFoj1T0QCxK6vtmPViq104zV4');
    res.json({ token });
  });

function verifyToken(req, res, next) {
    const bearerHeader = req.headers.authorization;
  
    if (typeof bearerHeader !== 'undefined') {
      const bearerToken = bearerHeader.split(' ')[1];
      req.token = bearerToken;
      jwt.verify(bearerToken, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFtbWFyIEFyaWVmIiwiaWF0IjoxNTE2MjM5MDIyfQ.tAMImjGRibpUGRWpuCJFoj1T0QCxK6vtmPViq104zV4', (err, authData) => {
        if (err) {
          res.sendStatus(403);
        } else {
          req.authData = authData;
          next();
        }
      });
    } else {
      res.sendStatus(403);
    }
  }
  

server.listen(port, function () {
    console.log('App running on *: ' + port);
});