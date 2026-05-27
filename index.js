const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

// Create credentials directory if it doesn't exist
const credentialsDir = './credentials';
if (!fs.existsSync(credentialsDir)) {
  fs.mkdirSync(credentialsDir);
}

// Bot commands
const commands = {
  '/help': 'Commandes disponibles:\n/help - Affiche cette aide\n/info - À propos du bot\n/heure - Heure actuelle\n/prix - Tarifs\n/contact - Contact\n/données - Récupère les données',
  '/info': 'Bot WhatsApp Business v1.0.0\nCréé pour automatiser vos réponses WhatsApp',
  '/heure': new Date().toLocaleTimeString('fr-FR'),
  '/prix': 'Tarifs:\n- Basic: 100€\n- Pro: 250€\n- Enterprise: Sur demande',
  '/contact': 'Contact:\nEmail: contact@bot-wa.com\nTéléphone: +33 6 XX XX XX XX',
  '/données': 'Données récupérées avec succès!\nUtilisateurs actifs: 1250\nMessages traités: 5430'
};

// Auto-response keywords
const autoResponses = {
  'bonjour': 'Bonjour! 👋 Comment puis-je vous aider?',
  'salut': 'Salut! 👋 Bienvenue sur notre bot',
  'merci': 'De rien! 😊 N\'hésitez pas si vous avez d\'autres questions',
  'aide': 'Tapez /help pour voir toutes les commandes disponibles'
};

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(credentialsDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['Bot-WA', 'Chrome', '1.0.0']
  });

  // Save credentials whenever they update
  sock.ev.on('creds.update', saveCreds);

  // Connection update handler
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      
      if (shouldReconnect) {
        console.log('Reconnecting...');
        startBot();
      } else {
        console.log('Bot disconnected. Please scan QR code again.');
      }
    } else if (connection === 'open') {
      console.log('✅ Bot connected successfully!');
      console.log('Bot WhatsApp Business is running');
    }
  });

  // Message handler
  sock.ev.on('messages.upsert', async (m) => {
    const message = m.messages[0];

    if (!message.message) return;
    if (message.key.fromMe) return;

    const text = message.message.conversation || 
                 message.message.extendedTextMessage?.text || 
                 '';

    const sender = message.key.remoteJid;
    const isGroup = sender.endsWith('@g.us');

    console.log(`📩 Message from ${sender}: ${text}`);

    let response = null;

    // Check for commands
    if (text.startsWith('/')) {
      response = commands[text.toLowerCase()] || 'Commande non reconnue. Tapez /help pour voir les commandes disponibles.';
    } else {
      // Check for auto-responses
      for (const [keyword, reply] of Object.entries(autoResponses)) {
        if (text.toLowerCase().includes(keyword)) {
          response = reply;
          break;
        }
      }
    }

    if (response) {
      await sock.sendMessage(sender, { text: response });
      console.log(`📤 Response sent to ${sender}`);
    }
  });
}

console.log('🤖 Bot WhatsApp Business starting...');
console.log('Scan the QR code below with WhatsApp to connect:\n');
startBot().catch(console.error);
