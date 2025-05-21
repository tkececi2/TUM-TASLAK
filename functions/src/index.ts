import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const serviceAccount = {
  "type": "service_account",
  "project_id": "yenisirket-2ec3b",
  "private_key_id": "your-private-key-id", // This should be replaced with actual private key ID
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----", // This should be replaced with actual private key
  "client_email": "firebase-adminsdk@yenisirket-2ec3b.iam.gserviceaccount.com",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40yenisirket-2ec3b.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  storageBucket: "yenisirket-2ec3b.firebasestorage.app"
});

export const storage = admin.storage();
export const bucket = storage.bucket();

// Webhook URL for n8n
const WEBHOOK_URL = 'https://your-webhook-url.com';

// Function to send arıza data to n8n webhook
export const sendArizaToWebhook = functions.firestore
  .document('arizalar/{arizaId}')
  .onCreate(async (snapshot, context) => {
    try {
      const arizaData = snapshot.data();
      const arizaId = context.params.arizaId;
      
      // Get saha details
      const sahaId = arizaData.saha;
      let sahaAdi = 'Bilinmeyen Saha';
      
      if (sahaId) {
        const sahaDoc = await admin.firestore().doc(`sahalar/${sahaId}`).get();
        if (sahaDoc.exists) {
          sahaAdi = sahaDoc.data()?.ad || 'Bilinmeyen Saha';
        }
      }
      
      // Get user details
      const kullaniciId = arizaData.olusturanKisi;
      let kullaniciAdi = 'Bilinmeyen Kullanıcı';
      
      if (kullaniciId) {
        const kullaniciDoc = await admin.firestore().doc(`kullanicilar/${kullaniciId}`).get();
        if (kullaniciDoc.exists) {
          kullaniciAdi = kullaniciDoc.data()?.ad || 'Bilinmeyen Kullanıcı';
        }
      }
      
      // Prepare data for webhook
      const webhookData = {
        id: arizaId,
        baslik: arizaData.baslik,
        aciklama: arizaData.aciklama,
        konum: arizaData.konum,
        oncelik: arizaData.oncelik,
        durum: arizaData.durum,
        sahaId: sahaId,
        sahaAdi: sahaAdi,
        olusturanKisiId: kullaniciId,
        olusturanKisiAdi: kullaniciAdi,
        olusturmaTarihi: arizaData.olusturmaTarihi.toDate().toISOString(),
        fotografSayisi: arizaData.fotograflar?.length || 0
      };
      
      // Send data to webhook
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      });
      
      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }
      
      console.log(`Arıza data sent to webhook successfully: ${arizaId}`);
      return { success: true };
      
    } catch (error) {
      console.error('Error sending arıza data to webhook:', error);
      return { success: false, error: error.message };
    }
  });

// Function to send arıza update to n8n webhook
export const sendArizaUpdateToWebhook = functions.firestore
  .document('arizalar/{arizaId}')
  .onUpdate(async (change, context) => {
    try {
      const newData = change.after.data();
      const oldData = change.before.data();
      const arizaId = context.params.arizaId;
      
      // Only send webhook if status has changed
      if (newData.durum === oldData.durum) {
        return null; // No status change, don't send webhook
      }
      
      // Get saha details
      const sahaId = newData.saha;
      let sahaAdi = 'Bilinmeyen Saha';
      
      if (sahaId) {
        const sahaDoc = await admin.firestore().doc(`sahalar/${sahaId}`).get();
        if (sahaDoc.exists) {
          sahaAdi = sahaDoc.data()?.ad || 'Bilinmeyen Saha';
        }
      }
      
      // Prepare data for webhook
      const webhookData = {
        id: arizaId,
        baslik: newData.baslik,
        eskiDurum: oldData.durum,
        yeniDurum: newData.durum,
        sahaId: sahaId,
        sahaAdi: sahaAdi,
        guncellenmeTarihi: newData.guncellenmeTarihi.toDate().toISOString(),
        islemTipi: 'durum_guncelleme'
      };
      
      // Send data to webhook
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      });
      
      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }
      
      console.log(`Arıza update sent to webhook successfully: ${arizaId}`);
      return { success: true };
      
    } catch (error) {
      console.error('Error sending arıza update to webhook:', error);
      return { success: false, error: error.message };
    }
  });