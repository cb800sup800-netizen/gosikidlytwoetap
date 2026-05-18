const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;
if (!token) { console.error('❌ TELEGRAM_TOKEN не указан'); process.exit(1); }

const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Telegram бот запущен');

const groupIds = (process.env.ADMIN_GROUP_IDS || '').split(',').filter(id => id.trim());
const NGROK_URL = 'https://ungustatory-curt-patently.ngrok-free.dev';

module.exports.notifyManagers = (user) => {
  const chatUrl = `${NGROK_URL}/chat.html?chatId=${user.chatId}&role=operator`;
  const text = `🆘 <b>НОВАЯ ЗАЯВКА</b>\n\n👤 ${user.fullName}\n📱 ${user.phone}\n📅 ${user.birthDate}\n❓ ${user.problem}\n🕒 ${new Date(user.timestamp).toLocaleString('ru-RU')}`;

  groupIds.forEach(async (groupId) => {
    try {
      await bot.sendMessage(groupId.trim(), text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: "🔗 Открыть чат и подключиться", url: chatUrl }]] }
      });
    } catch (err) { console.error(`Ошибка отправки в ${groupId}:`, err.message); }
  });
};

bot.on('polling_error', (error) => {
  if (!error.message.includes('409')) console.error('Polling error:', error.message);
});