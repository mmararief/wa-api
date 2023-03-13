const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const express = require('express');

const { body, validationResult } = require('express-validator');

const socketIO = require('socket.io')

const http = require('http')

const qrcode = require('qrcode');

const fs = require('fs');

const ytdl = require('ytdl-core');

const axios = require('axios');


const port = process.env.PORT || 8000;






const app = express();

const server = http.createServer(app);

const io = socketIO(server);

app.use(express.json());

app.use(express.urlencoded({ extended: true}));





app.get('/', (req, res) => {

    res.sendFile('index.html', { root: __dirname });

});

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

    console.log(`seseorang berkata: ${msg.body}`);

    if (msg.body == '!ping') {

        msg.reply('pong');

    }



    if (msg.body.startsWith('!sticker') && msg.type == 'image'){

        const media = await msg.downloadMedia();



        client.sendMessage(msg.from, media, {

            sendMediaAsSticker: true,

        });

    }



    



    if (msg.body.toLowerCase().startsWith('!yt')) {
        const url = msg.body.substring(9);

        try {
            const videoInfo = await ytdl.getInfo(url);

            const video = ytdl(url, { quality: 'highest' });

            client.sendMessage(msg.from, 'Amay edang memproses video, harap tunggu...');

            const stream = video.pipe(fs.createWriteStream(`${videoInfo.videoDetails.title}.mp4`));

            stream.on('finish', () => {
                const media = MessageMedia.fromFilePath(`${videoInfo.videoDetails.title}.mp4`);

                client.sendMessage(msg.from, `Berhasil mengunduh video ${videoInfo.videoDetails.title}`);
                client.sendMessage(msg.from, media, {sendMediaAsDocument: true});
            });
        } catch (error) {
            console.error(error);
            msg.reply('Terjadi kesalahan saat mengunduh video.');
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
      
  
  
    if (msg.body.startsWith('!info')) {
        const contactId = msg.body.split(' ')[1];
        const contact = await client.getContactById(contactId);
        if (!contact) {
            msg.reply('Kontak tidak ditemukan.');
            return;
        }
        let message = `${contact.name}\nNomor Telepon: ${contact.number}\n`;
        const profilePicUrl = await contact.getProfilePicUrl();
        if (profilePicUrl) {
            message += `Gambar Profil: ${profilePicUrl}\n`;
        }
        if (contact.about) {
            message += `Bio: ${contact.about}`;
        }
        msg.reply(message);
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



// send message

app.post('/send-message', [

    body('number').notEmpty(),

    body('message').notEmpty(),

], (req, res) => {

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




server.listen(port, function () {

    console.log('App running on *: ' + port);

});