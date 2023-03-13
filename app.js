const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const express = require('express');

const { body, validationResult } = require('express-validator');

const socketIO = require('socket.io')

const http = require('http')

const qrcode = require('qrcode');

const fs = require('fs');

const ytdl = require('ytdl-core');


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

        const command = msg.body.split(' ');

        const url = command[1];

        const format = command[2] || 'mp4';



        try {

            const videoInfo = await ytdl.getInfo(url);



            const content = format === 'mp3' ? 'audio' : 'konten';

            client.sendMessage(msg.from, `Amay Sedang memproses ${content}, harap tunggu ya masbro`);



            const video = ytdl(url, { quality: 'highest' });



            const stream = video.pipe(fs.createWriteStream(`${videoInfo.videoDetails.title}.${format}`));



            stream.on('finish', () => {

            const media = MessageMedia.fromFilePath(`${videoInfo.videoDetails.title}.${format}`);



            const successMsg = format === 'mp3' ? 'Berhasil mengunduh audio' : 'Berhasil mengunduh video';

            client.sendMessage(msg.from, successMsg);

            client.sendMessage(msg.from, media, { sendMediaAsDocument: true });

            fs.unlink(`${videoInfo.videoDetails.title}.${format}`, (err) => {

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