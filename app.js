const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io')
const http = require('http')
const qrcode = require('qrcode');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const ytdl = require('ytdl-core');
const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');
const port = process.env.PORT || 8000;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const mysql = require('mysql2');

// Konfigurasi koneksi ke database MySQL
const dbConfig = {
    host: 'viaduct.proxy.rlwy.net',
    port: '14615',
    user: 'root',
    password: 'fpaLecgRPYsjKhdhpyRdoGZvrTFZZIbl',
    database: 'railway',
};

// Membuat koneksi ke database
const connection = mysql.createConnection(dbConfig);

// Membuka koneksi
connection.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        return;
    }
    console.log('Connected to MySQL database');
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true}));


app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

app.get('/token', (req, res) => {
  res.sendFile('token.html', { root: __dirname });
});

const kelompok = [
  'ALIFYA HARSYARANI',
  'AMARA LUTHFI VANNESA',
  'AMELIA FITRI GITALAVANCHA',
  'ANGGER RIZKY RAMBUDIA',
  'ANNISA NURUL ASRI',
  'ARRAHMAN AKMAL',
  'AUREL FEYBILYA SIMAMORA',
  'AZZAHRA DANIA INDRIYANI',
  'DANTY ZAHRA NADHIRA',
  'DEFANIA ADESTI',
  'DELLIA PUTRI SANTOSO',
  'DESVITA DAMAYANTI',
  'DIMAS NAUFAL HERMAWAN',
  'DINDA RIFKA TIAS NOVANSA',
  'DWIKI DIANDRA PUTRA',
  'FAUZAN DIFA',
  'HERU MUZAKI ALPIAN',
  'HUWAIDA ADILLYA PUTRI',
  'KAYLAH AHLA HANINA',
  'MIFTA RIZALDIRAHMAT',
  'MOCH HARIS SAPUTRA',
  'MUHAMMAD ALIF AL GHIFARI',
  'MUHAMMAD AMMAR ARIEF',
  'MUHAMMAD DAFFA RAJENDRA',
  'MUHAMMAD FAJAR FEBRIAN',
  'MUHAMMAD NAUFAL HILMY',
  'MUHAMMAD RYO SETIAWAN',
  'NAUFAL AMRU',
  'NISRINA SYIFA',
  'NOOR SYIVA SYAKIRA WAHDANIE',
  'RAKHA ADITISNA KUMARA',
  'RIZKY RAMDHANI KOSWARA',
  'ROSA LINDA SALSABILA',
  'SABRINA NAJWA APRILIANTI',
  'STEFY RUSLANDA',
  'TRI ANGGORO SAPUTRI',
];



const client = new Client({
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
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
        console.log(msg.from)
    }


    if (msg.body.startsWith('!sticker') && msg.type == 'image'){
        const media = await msg.downloadMedia();
        client.sendMessage(msg.from, media, {
            sendMediaAsSticker: true,
        });
    }
    if (msg.body == '!buatkelompok') {
      const kelompokName = await askQuestion(msg.from, 'Masukkan nama kelompok:');
      const kelompokNameExists = await checkKelompokName(kelompokName);
      if(kelompokNameExists) {
          msg.reply('Nama kelompok sudah digunakan, gunakan nama kelompok yang lain.');
          return;
      }
      const jumlahKelompok = await askQuestion(msg.from, 'Mau dibuatkan berapa kelompok?');
      createKelompok(kelompokName, jumlahKelompok, kelompok, msg );
      msg.reply(`Kelompok ${kelompokName} berhasil dibuat dengan ${jumlahKelompok} kelompok.`);
  }

  if (msg.body == '!carikelompok') {
    const kelompokName = await askQuestion(msg.from, 'Masukkan nama kelompok yang ingin dicari:');
    searchKelompok(kelompokName, msg);
  }

  if (msg.body.toLowerCase().startsWith('!yt')) {
    const command = msg.body.split(' ');
    const url = command[1];
    const format = command[2] || 'mp4';
    try {
        const videoInfo = await ytdl.getInfo(url);
        const content = format === 'mp3' ? 'audio' : 'konten';
        const cleanTitle = videoInfo.videoDetails.title.replace(/[\\/:*?"<>|]/g, '');
        const videoPath = `./${cleanTitle}.${format}`;
        client.sendMessage(msg.from, `Amay Sedang memproses ${content}, harap tunggu ya masbro`);
        const video = ytdl(url, { quality: 'highest' });
        const stream = video.pipe(fs.createWriteStream(videoPath));
        stream.on('finish', () => {
            const media = MessageMedia.fromFilePath(videoPath);
            const successMsg = format === 'mp3' ? 'Berhasil mengunduh audio' : 'Berhasil mengunduh video';
            client.sendMessage(msg.from, successMsg);
            client.sendMessage(msg.from, media, { sendMediaAsDocument: true });
            fs.unlink(videoPath, (err) => {
                if (err) {
                    console.error(err);
                    return;
                }
                console.log('File telah dihapus');
            });
        });
    } catch (error) {
        console.error(error);
        msg.reply('Terjadi kesalahan saat mengunduh video / link belum di tambahkan');
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
        

        });




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



async function checkKelompokName(kelompokName) {
  return new Promise((resolve, reject) => {
      const query = 'SELECT COUNT(*) AS count FROM kelompok WHERE nama_kelompok = ?';
      connection.query(query, [kelompokName], (err, result) => {
          if (err) {
              console.error('Error checking kelompok name:', err);
              reject(err);
              return;
          }
          resolve(result[0].count > 0);
      });
  });
}

function createKelompok(kelompokName, jumlahKelompok, members, msg) {
  // Memastikan jumlah anggota cukup untuk dibagi menjadi kelompok
  if (members.length < jumlahKelompok) {
      console.error('Jumlah anggota tidak mencukupi untuk dibagi menjadi kelompok');
      return;
  }

  // Mengacak anggota untuk mendapatkan urutan acak
  const shuffledMembers = shuffleArray(members);

  // Variabel untuk menyimpan anggota semua kelompok dalam format yang diinginkan
  let anggotaAllKelompok = '';

  // Membuat kelompok
  for (let i = 1; i <= jumlahKelompok; i++) {
      const namaKelompok = `${kelompokName} ${i}`;
      const anggotaKelompok = shuffledMembers.slice((i - 1) * Math.ceil(members.length / jumlahKelompok), i * Math.ceil(members.length / jumlahKelompok));

      // Menambahkan anggota kelompok ke variabel anggotaAllKelompok
      anggotaAllKelompok += `Kelompok ${i}: \n${anggotaKelompok.join('\n')}\n`;
  }

  const query = 'INSERT INTO kelompok (nama_kelompok, jumlah_anggota, anggota) VALUES (?, ?, ?)';
  const values = [kelompokName, members.length, anggotaAllKelompok];
  
  // Menjalankan query untuk menyimpan kelompok ke database
  connection.query(query, values, (err, result) => {
      if (err) {
          console.error('Error saving kelompok to database:', err);
          return;
      }
      
      console.log('Kelompok berhasil disimpan ke database');

      // Kirim pesan dengan isi kelompok
      const chatId = msg.from;
      client.sendMessage(chatId, `Kelompok ${kelompokName} berhasil dibuat dengan ${jumlahKelompok} kelompok:\n${anggotaAllKelompok}`);
  });
}

async function searchKelompok(kelompokName, msg) {
  const query = 'SELECT * FROM kelompok WHERE nama_kelompok = ?';
  connection.query(query, [kelompokName], (err, result) => {
      if (err) {
          console.error('Error searching kelompok:', err);
          msg.reply('Terjadi kesalahan saat mencari kelompok.');
          return;
      }
      if (result.length === 0) {
          msg.reply(`Kelompok dengan nama ${kelompokName} tidak ditemukan.`);
      } else {
          msg.reply(`Kelompok ${kelompokName} ditemukan dengan ${result[0].jumlah_anggota} anggota:\n${result[0].anggota}`);
      }
  });
}



// Fungsi untuk mengacak array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


async function askQuestion(sender, question) {
  client.sendMessage(sender, question);
  return new Promise(resolve => {
      client.on('message', async (msg) => {
          if (msg.from === sender) {
              resolve(msg.body);
          }
      });
  });
}

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