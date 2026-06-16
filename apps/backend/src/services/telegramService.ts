import axios from 'axios';

/**
 * Sends a notification message to a Telegram chat/group via the Telegram Bot API.
 */
export async function sendTelegramAlert(
  botToken: string | null | undefined,
  chatId: string | null | undefined,
  text: string,
  replyMarkup?: any
): Promise<boolean> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chat = chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chat) {
    console.warn('⚠️ Telegram Bot Token or Chat ID not configured. Skipping alert.');
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chat,
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
      reply_markup: replyMarkup,
    });
    return true;
  } catch (error: any) {
    console.error('❌ Failed to send Telegram alert:', error.response?.data || error.message);
    
    // Fallback: retry without Markdown in case of formatting errors (e.g. unclosed asterisks)
    try {
      const sanitizedText = text.replace(/[*_`\[\]()]/g, '');
      await axios.post(url, {
        chat_id: chat,
        text: `[FALLBACK ALERT]\n\n${sanitizedText}`,
      });
      return true;
    } catch (retryError: any) {
      console.error('❌ Failed to send fallback Telegram alert:', retryError.response?.data || retryError.message);
      throw new Error(`Telegram Send Error: ${error.message}`);
    }
  }
}
