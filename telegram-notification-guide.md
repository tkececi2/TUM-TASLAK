# 🤖 Telegram Bot ile Yeni Kullanıcı Bildirimi

## 📋 Telegram Bot Kurulumu (5 Dakika)

### 1. Telegram Bot Oluşturma
1. Telegram'da **@BotFather**'a mesaj gönderin
2. `/newbot` yazın
3. Bot adını girin (örnek: "Şirket Bildirim Botu")
4. Bot kullanıcı adını girin (örnek: @sirket_bildirim_bot)
5. Size bir **API Token** verecek (örnek: `1234567890:ABC-DEF1234567890ABC`)

### 2. Chat ID Öğrenme
1. Botunuza bir mesaj gönderin
2. Bu URL'e gidin: `https://api.telegram.org/bot{TOKEN}/getUpdates`
3. `{TOKEN}` yerine botunuzun token'ini yazın
4. Sonuçta `chat.id` numaranızı bulun

### 3. Firebase'de Kullanım

```typescript
// Frontend'de yeni kullanıcı kaydında
const sendTelegramNotification = async (userData: any) => {
  const botToken = 'SIZIN-BOT-TOKEN';
  const chatId = 'SIZIN-CHAT-ID';
  
  const message = `
🆕 *Yeni Kullanıcı Kaydı*

👤 Ad Soyad: ${userData.ad}
📧 E-posta: ${userData.email}
📱 Telefon: ${userData.telefon}
🎯 Rol: ${userData.rol}
📅 Tarih: ${new Date().toLocaleString('tr-TR')}
`;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    })
  });
};
```

### 4. AuthContext'e Ekleme

`src/contexts/AuthContext.tsx` dosyasında signup fonksiyonuna ekleyin:

```typescript
// Kullanıcı başarıyla kaydedildikten sonra
await sendTelegramNotification(userData);
```

## ✅ Avantajları
- ✅ Tamamen ücretsiz
- ✅ Anında bildirim
- ✅ Mobilde hemen görürüsünüz
- ✅ Kurulumu çok kolay
- ✅ Firebase Functions gerekmez
- ✅ Resim, dosya da gönderebilir

## 📱 Alternatif: Discord Webhook
Discord kullanıyorsanız webhook daha kolay:

```typescript
const sendDiscordNotification = async (userData: any) => {
  const webhookUrl = 'DISCORD-WEBHOOK-URL';
  
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🆕 **Yeni Kullanıcı:** ${userData.ad} (${userData.email})`
    })
  });
};
``` 