const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_API_TOKEN;

TelegramBot.prototype._requestOptions = {
  forever: true,
  pool: {
    maxSockets: Infinity,
  },
  gzip: true,
  timeout: 10 * 1000,
  followRedirect: true,
  followAllRedirects: true,
  resolveWithFullResponse: true,
  simple: false,
  json: true,
  maxRedirects: 10,
  fullResponse: true,
  timeout: 10 * 1000,
  gzip: true,
  time: true,
  json: true,
};

const bot = new TelegramBot(token, { polling: true, autoPromiseCancel: true });

let db = new sqlite3.Database('./telegram_bot.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the database.');
});

db.run(`CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        email TEXT NOT NULL,
        sol_wallet TEXT NOT NULL)`);

db.run(`CREATE TABLE IF NOT EXISTS history (
        user_id INTEGER,
        choice TEXT,
        result TEXT,
        FOREIGN KEY(user_id) REFERENCES users(user_id))`);

// Show start button
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Start', callback_data: 'start' }]
      ]
    }
  };
  bot.sendMessage(chatId, 'Welcome! Click the button below to register:', options);
});

// Handle start button click
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const action = callbackQuery.data;

  if (action === 'start') {
    // Check if the user is already registered
    db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) => {
      if (err) {
        return console.error(err.message);
      }
      if (row) {
        bot.sendMessage(chatId, 'You are already registered! You can now /play the game.');
      } else {
        bot.sendMessage(chatId, 'Please register by providing your email and Solana wallet address in the format: email,sol_wallet');
      }
    });
  } else if (action === 'play') {
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'HEAD', callback_data: 'head' }],
          [{ text: 'TAIL', callback_data: 'tail' }]
        ]
      }
    };
    bot.sendMessage(chatId, 'Choose HEAD or TAIL:', options);
  } else if (action === 'history') {
    db.all(`SELECT choice, result FROM history WHERE user_id = ?`, [chatId], (err, rows) => {
      if (err) {
        throw err;
      }

      let history = 'Game History:\n';
      rows.forEach((row) => {
        history += `You chose ${row.choice} and the result was ${row.result}\n`;
      });

      bot.sendMessage(chatId, history || 'No game history available.');
    });
  } else if (action === 'exit') {
    bot.sendMessage(chatId, 'Thank you for playing!');
  } else if (action === 'head' || action === 'tail') {
    const choice = action;
    const result = Math.random() < 0.5 ? 'head' : 'tail';

    db.run(`INSERT INTO history (user_id, choice, result) VALUES (?, ?, ?)`, [chatId, choice, result], function(err) {
      if (err) {
        return console.error(err.message);
      }

      if (choice === result) {
        bot.sendMessage(chatId, `You chose ${choice} and the coin landed on ${result}. You win!`);
      } else {
        bot.sendMessage(chatId, `You chose ${choice} and the coin landed on ${result}. You lose.`);
      }

      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Play', callback_data: 'play' }],
            [{ text: 'History', callback_data: 'history' }],
            [{ text: 'Exit', callback_data: 'exit' }]
          ]
        }
      };
      bot.sendMessage(chatId, 'Choose an option:', options);
    });
  }
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text.includes(',') && !text.startsWith('/')) {
    const [email, sol_wallet] = text.split(',');

    // Check if user is already registered
    db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) => {
      if (err) {
        return console.error(err.message);
      }
      if (row) {
        bot.sendMessage(chatId, 'You are already registered! You can now /play the game.');
      } else {
        db.run(`INSERT INTO users (user_id, email, sol_wallet) VALUES (?, ?, ?)`, [chatId, email, sol_wallet], function(err) {
          if (err) {
            return console.error(err.message);
          }
          bot.sendMessage(chatId, 'Registration successful! You can now /play the game.');
        });
      }
    });
  }
});

bot.onText(/\/play/, (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'HEAD', callback_data: 'head' }],
        [{ text: 'TAIL', callback_data: 'tail' }]
      ]
    }
  };
  bot.sendMessage(chatId, 'Choose HEAD or TAIL:', options);
});

bot.onText(/\/history/, (msg) => {
  const user_id = msg.chat.id;

  db.all(`SELECT choice, result FROM history WHERE user_id = ?`, [user_id], (err, rows) => {
    if (err) {
      throw err;
    }
    
    let history = 'Game History:\n';
    rows.forEach((row) => {
      history += `You chose ${row.choice} and the result was ${row.result}\n`;
    });

    bot.sendMessage(user_id, history || 'No game history available.');
  });
});

bot.onText(/\/exit/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Thank you for playing!');
});
