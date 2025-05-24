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
        throw new Error(`Webhook Error: ${response.status} ${response.statusText}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error sending webhook:', error);
      return { error: error.message };
    }
  });

// E-posta bildirimleri gönderme fonksiyonu
export const sendArizaEmailNotifications = functions.firestore
  .document('arizalar/{arizaId}')
  .onWrite(async (change, context) => {
    try {
      const arizaId = context.params.arizaId;
      
      // Belge silindiyse işlem yapma
      if (!change.after.exists) {
        return null;
      }
      
      const arizaData = change.after.data();
      
      // Bildirim zaten gönderildiyse çık
      if (arizaData.bildirimGonderildi === true) {
        return null;
      }
      
      // Bildirim tipi yoksa işlem yapma
      if (!arizaData.bildirimTipi) {
        return null;
      }
      
      // Arıza bilgilerini al
      const baslik = arizaData.baslik;
      const aciklama = arizaData.aciklama;
      const konum = arizaData.konum;
      const durum = arizaData.durum;
      const oncelik = arizaData.oncelik;
      const companyId = arizaData.companyId;
      
      // Saha bilgilerini al
      let sahaAdi = 'Bilinmeyen Saha';
      if (arizaData.saha) {
        const sahaDoc = await admin.firestore().doc(`sahalar/${arizaData.saha}`).get();
        if (sahaDoc.exists) {
          sahaAdi = sahaDoc.data()?.ad || 'Bilinmeyen Saha';
        }
      }
      
      // Bildirimi göndereceğimiz kişileri belirle
      let aliciIdleri: string[] = [];
      let aliciEmailleri: string[] = [];
      
      if (arizaData.bildirimTipi === 'ariza_olusturuldu') {
        // Yöneticileri ve arıza atanan kişiyi bul
        const yoneticiQuery = await admin.firestore()
          .collection('kullanicilar')
          .where('rol', '==', 'yonetici')
          .where('companyId', '==', companyId)
          .get();
        
        aliciIdleri = yoneticiQuery.docs.map(doc => doc.id);
        
        // Atanan kişi varsa ekle
        if (arizaData.atananKisi) {
          aliciIdleri.push(arizaData.atananKisi);
        }
      } else if (arizaData.bildirimTipi === 'ariza_cozuldu') {
        // Arızayı oluşturan kişi ve yöneticileri bul
        if (arizaData.olusturanKisi) {
          aliciIdleri.push(arizaData.olusturanKisi);
        }
        
        const yoneticiQuery = await admin.firestore()
          .collection('kullanicilar')
          .where('rol', '==', 'yonetici')
          .where('companyId', '==', companyId)
          .get();
        
        yoneticiQuery.docs.forEach(doc => {
          if (!aliciIdleri.includes(doc.id)) {
            aliciIdleri.push(doc.id);
          }
        });
      }
      
      // Alıcı e-posta adreslerini topla
      if (aliciIdleri.length > 0) {
        const aliciVerileri = await Promise.all(
          aliciIdleri.map(id => 
            admin.firestore().doc(`kullanicilar/${id}`).get()
          )
        );
        
        aliciEmailleri = aliciVerileri
          .filter(doc => doc.exists && doc.data()?.email)
          .map(doc => doc.data()?.email);
      }
      
      // E-posta gönder
      if (aliciEmailleri.length > 0) {
        const mailOptions = {
          from: '"GES Yönetim Sistemi" <noreply@gesyonetim.com>',
          to: aliciEmailleri.join(','),
          subject: arizaData.bildirimTipi === 'ariza_olusturuldu' 
            ? `Yeni Arıza Bildirimi: ${baslik}` 
            : `Arıza Çözüldü: ${baslik}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: ${arizaData.bildirimTipi === 'ariza_olusturuldu' ? '#f97316' : '#22c55e'}; padding: 20px; text-align: center; color: white;">
                <h1>${arizaData.bildirimTipi === 'ariza_olusturuldu' ? 'Yeni Arıza Bildirimi' : 'Arıza Çözüldü'}</h1>
              </div>
              <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
                <h2 style="color: #374151;">${baslik}</h2>
                <p style="color: #4b5563;"><strong>Açıklama:</strong> ${aciklama}</p>
                <p style="color: #4b5563;"><strong>Konum:</strong> ${konum}</p>
                <p style="color: #4b5563;"><strong>Saha:</strong> ${sahaAdi}</p>
                <p style="color: #4b5563;"><strong>Durum:</strong> ${durum.charAt(0).toUpperCase() + durum.slice(1).replace('-', ' ')}</p>
                <p style="color: #4b5563;"><strong>Öncelik:</strong> ${oncelik.charAt(0).toUpperCase() + oncelik.slice(1)}</p>
                <div style="margin-top: 30px; text-align: center;">
                  <a href="${process.env.APP_URL || 'https://gesyonetim.com'}/arizalar/${arizaId}" 
                     style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                    Arıza Detaylarını Görüntüle
                  </a>
                </div>
              </div>
              <div style="background-color: #f3f4f6; padding: 10px; text-align: center; font-size: 12px; color: #6b7280;">
                <p>Bu e-posta GES Yönetim Sistemi tarafından otomatik olarak gönderilmiştir.</p>
              </div>
            </div>
          `
        };
        
        // Burada gerçek e-posta gönderme işlemi yapılacak
        // Firebase Extensions > Trigger Email kullanabilirsiniz
        // Veya nodemailer ile SMTP üzerinden e-posta gönderebilirsiniz
        
        console.log('E-posta gönderilecek:', mailOptions);
        
        // Extensions'a email gönderme isteği ekle
        await admin.firestore().collection('mail').add({
          to: aliciEmailleri,
          message: {
            subject: mailOptions.subject,
            html: mailOptions.html
          }
        });
      }
      
      // Bildirimi gönderildi olarak işaretle
      await admin.firestore().doc(`arizalar/${arizaId}`).update({
        bildirimGonderildi: true
      });
      
      return { success: true, recipientCount: aliciEmailleri.length };
    } catch (error) {
      console.error('E-posta gönderme hatası:', error);
      return { error: error.message };
    }
  });se.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }
      
      console.log(`Arıza update sent to webhook successfully: ${arizaId}`);
      return { success: true };
      
    } catch (error) {
      console.error('Error sending arıza update to webhook:', error);
      return { success: false, error: error.message };
    }
  });

// Function to set custom claims for user roles
export const setUserRole = functions.https.onCall(async (data, context) => {
  // Check if the request is made by an authenticated user
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  // Check if the caller is an admin
  const callerUid = context.auth.uid;
  const callerDoc = await admin.firestore().doc(`kullanicilar/${callerUid}`).get();
  
  if (!callerDoc.exists) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Caller not found in database.'
    );
  }
  
  const callerData = callerDoc.data();
  const isAdmin = callerData?.rol === 'yonetici' || callerData?.rol === 'superadmin';
  
  if (!isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can set user roles.'
    );
  }

  // Get parameters
  const { userId, role } = data;
  
  if (!userId || !role) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with userId and role parameters.'
    );
  }

  // Validate role
  const validRoles = ['yonetici', 'tekniker', 'muhendis', 'musteri', 'bekci', 'superadmin'];
  if (!validRoles.includes(role)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Role must be one of: ${validRoles.join(', ')}`
    );
  }

  try {
    // Set custom claim
    await admin.auth().setCustomUserClaims(userId, { rol: role });
    
    // Update user document in Firestore
    await admin.firestore().doc(`kullanicilar/${userId}`).update({
      rol: role,
      guncellenmeTarihi: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, message: `User ${userId} role set to ${role}` };
  } catch (error) {
    console.error('Error setting user role:', error);
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while setting the user role.'
    );
  }
});

// Function to sync user roles from Firestore to Auth custom claims
export const syncUserRoles = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  try {
    const usersSnapshot = await admin.firestore().collection('kullanicilar').get();
    
    const updates = usersSnapshot.docs.map(async (doc) => {
      const userData = doc.data();
      const userId = doc.id;
      const role = userData.rol;
      
      if (role) {
        try {
          await admin.auth().setCustomUserClaims(userId, { rol: role });
          console.log(`Updated custom claims for user ${userId} with role ${role}`);
        } catch (error) {
          console.error(`Error updating custom claims for user ${userId}:`, error);
        }
      }
    });
    
    await Promise.all(updates);
    return { success: true, message: `Synced roles for ${updates.length} users` };
  } catch (error) {
    console.error('Error syncing user roles:', error);
    return { success: false, error: error.message };
  }
});

// Function to set custom claims when a new user is created in Firestore
export const setNewUserRole = functions.firestore
  .document('kullanicilar/{userId}')
  .onCreate(async (snapshot, context) => {
    try {
      const userData = snapshot.data();
      const userId = context.params.userId;
      const role = userData.rol;
      
      if (role) {
        await admin.auth().setCustomUserClaims(userId, { rol: role });
        console.log(`Set custom claims for new user ${userId} with role ${role}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error setting new user role:', error);
      return { success: false, error: error.message };
    }
  });

// Function to update custom claims when a user's role is updated in Firestore
export const updateUserRole = functions.firestore
  .document('kullanicilar/{userId}')
  .onUpdate(async (change, context) => {
    try {
      const newData = change.after.data();
      const oldData = change.before.data();
      const userId = context.params.userId;
      
      // Only update if the role has changed
      if (newData.rol !== oldData.rol) {
        await admin.auth().setCustomUserClaims(userId, { rol: newData.rol });
        console.log(`Updated custom claims for user ${userId} with new role ${newData.rol}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating user role:', error);
      return { success: false, error: error.message };
    }
  });