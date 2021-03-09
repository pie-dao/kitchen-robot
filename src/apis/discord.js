const fetch = require('node-fetch');
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

const discord = async (message) => {
  let msg = message;
  if (webhookUrl) {
    const body = JSON.stringify({ content: msg });
    const headers = { 'Content-Type': 'application/json' };
    const response = await fetch(webhookUrl, { method: 'POST', body, headers });
  }
};

exports.notify = discord;