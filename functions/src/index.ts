import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import * as nodemailer from 'nodemailer';

// Initialize Firebase Admin with default settings
admin.initializeApp();

// Email configuration - Use environment variables in production
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: functions.config().email?.user || 'your-email@gmail.com',
    pass: functions.config().email?.pass || 'your-app-password'
  }
};

// Admin email to receive notifications
const ADMIN_EMAIL = functions.config().email?.admin || 'admin@yourcompany.com';

// Function to send email notification for new user registration
export const sendNewUserNotification = functions.firestore
  .document('kullanicilar/{userId}')
  .onCreate(async (snapshot, context) => {
    try {
      const userData = snapshot.data();
      const userId = context.params.userId;
      
      console.log(`🆕 Yeni kullanıcı kaydı: ${userData.email} (${userId})`);
      
      // Create nodemailer transporter
      const transporter = nodemailer.createTransport({
        service: EMAIL_CONFIG.service,
        auth: EMAIL_CONFIG.auth
      });

      // Get company name if available
      let companyName = 'Bilinmeyen Şirket';
      if (userData.companyId) {
        try {
          const companyDoc = await admin.firestore().doc(`companies/${userData.companyId}`).get();
          if (companyDoc.exists) {
            companyName = companyDoc.data()?.name || 'Bilinmeyen Şirket';
          }
        } catch (err) {
          console.log('Company bilgisi alınamadı:', err);
        }
      }

      // Prepare email content
      const mailOptions = {
        from: EMAIL_CONFIG.auth.user,
        to: ADMIN_EMAIL,
        subject: '🆕 Yeni Kullanıcı Kaydı - Sistem Bildirimi',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #4f46e5; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Yeni Kullanıcı Kaydı</h1>
            </div>
            
            <div style="padding: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb;">
              <h2 style="color: #1f2937; margin-top: 0;">📋 Kullanıcı Bilgileri</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; font-weight: bold; color: #374151;">👤 Ad Soyad:</td>
                  <td style="padding: 8px; color: #6b7280;">${userData.ad || 'Belirtilmemiş'}</td>
                </tr>
                <tr style="background-color: #f3f4f6;">
                  <td style="padding: 8px; font-weight: bold; color: #374151;">📧 E-posta:</td>
                  <td style="padding: 8px; color: #6b7280;">${userData.email || 'Belirtilmemiş'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; color: #374151;">📱 Telefon:</td>
                  <td style="padding: 8px; color: #6b7280;">${userData.telefon || 'Belirtilmemiş'}</td>
                </tr>
                <tr style="background-color: #f3f4f6;">
                  <td style="padding: 8px; font-weight: bold; color: #374151;">🎯 Rol:</td>
                  <td style="padding: 8px; color: #6b7280;">${userData.rol || 'Belirtilmemiş'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; color: #374151;">🏢 Şirket:</td>
                  <td style="padding: 8px; color: #6b7280;">${companyName}</td>
                </tr>
                <tr style="background-color: #f3f4f6;">
                  <td style="padding: 8px; font-weight: bold; color: #374151;">🆔 Kullanıcı ID:</td>
                  <td style="padding: 8px; color: #6b7280; font-family: monospace; font-size: 12px;">${userId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; color: #374151;">📅 Kayıt Tarihi:</td>
                  <td style="padding: 8px; color: #6b7280;">${new Date().toLocaleString('tr-TR')}</td>
                </tr>
              </table>
            </div>
            
            <div style="padding: 20px; text-align: center; background-color: #fef3c7; border: 1px solid #f59e0b;">
              <p style="margin: 0; color: #92400e;">
                ⚠️ Bu kullanıcının sistem erişimi kontrol edilmeli ve gerekirse onaylanmalıdır.
              </p>
            </div>
            
            <div style="padding: 20px; text-align: center; background-color: #f3f4f6; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                Bu e-posta otomatik olarak sistem tarafından gönderilmiştir.
              </p>
            </div>
          </div>
        `
      };

      // Send email
      await transporter.sendMail(mailOptions);
      
      console.log(`✅ Yeni kullanıcı bildirimi gönderildi: ${userData.email} (${userId})`);
      return { success: true, message: 'E-posta bildirimi gönderildi' };
      
    } catch (error) {
      console.error('❌ Yeni kullanıcı e-posta bildirimi gönderilemedi:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

// Function to update user custom claims
export const updateUserClaims = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Kullanıcı kimlik doğrulaması yapılmamış');
    }

    const uid = context.auth.uid;
    
    // Get user data from Firestore
    const userDoc = await admin.firestore().doc(`kullanicilar/${uid}`).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı');
    }

    const userData = userDoc.data();
    if (!userData) {
      throw new functions.https.HttpsError('not-found', 'Kullanıcı verisi bulunamadı');
    }

    // Set custom claims based on user role
    const customClaims = {
      rol: userData.rol,
      companyId: userData.companyId,
      lastUpdated: Date.now()
    };

    // Update custom claims
    await admin.auth().setCustomUserClaims(uid, customClaims);
    
    console.log(`✅ Kullanıcı token'ı güncellendi: ${userData.email} (${uid}), rol: ${userData.rol}`);
    
    return { 
      success: true, 
      message: 'Token başarıyla güncellendi',
      claims: customClaims
    };
    
  } catch (error) {
    console.error('❌ Token güncelleme hatası:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Token güncellenirken hata oluştu');
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

// Müşterilere arıza bildirimi gönderen fonksiyon
export const sendArizaNotificationToCustomers = functions.firestore
  .document('arizalar/{arizaId}')
  .onCreate(async (snapshot, context) => {
    try {
      const arizaData = snapshot.data();
      const arizaId = context.params.arizaId;
      
      console.log(`🔔 Yeni arıza için müşteri bildirimi: ${arizaId}`);
      
      // Şirket bilgilerini al
      const companyDoc = await admin.firestore().doc(`companies/${arizaData.companyId}`).get();
      const companyName = companyDoc.exists ? companyDoc.data()?.name || 'SolarVeyo' : 'SolarVeyo';
      
      // Saha bilgilerini al
      let sahaAdi = 'Bilinmeyen Saha';
      if (arizaData.saha) {
        const sahaDoc = await admin.firestore().doc(`sahalar/${arizaData.saha}`).get();
        if (sahaDoc.exists) {
          sahaAdi = sahaDoc.data()?.ad || 'Bilinmeyen Saha';
        }
      }
      
      // Bu sahaya atanan müşterileri bul
      const customersQuery = await admin.firestore()
        .collection('kullanicilar')
        .where('rol', '==', 'musteri')
        .where('companyId', '==', arizaData.companyId)
        .where('sahalar', 'array-contains', arizaData.saha)
        .get();
      
      if (customersQuery.empty) {
        console.log('Bu saha için müşteri bulunamadı');
        return { success: true, message: 'Müşteri bulunamadı' };
      }
      
      // E-posta gönderimi için transporter oluştur
      const transporter = nodemailer.createTransport({
        service: EMAIL_CONFIG.service,
        auth: EMAIL_CONFIG.auth
      });
      
      const emailPromises = customersQuery.docs.map(async (customerDoc) => {
        const customerData = customerDoc.data();
        
        const mailOptions = {
          from: EMAIL_CONFIG.auth.user,
          to: customerData.email,
          subject: `🚨 Arıza Bildirimi - ${sahaAdi}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #dc2626; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">🚨 Arıza Bildirimi</h1>
              </div>
              
              <div style="padding: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb;">
                <h2 style="color: #1f2937; margin-top: 0;">Sayın ${customerData.ad},</h2>
                <p style="color: #374151;">Sizin atandığınız sahada bir arıza tespit edilmiştir:</p>
                
                <div style="background-color: #fee2e2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px; font-weight: bold; color: #374151;">🏢 Saha:</td>
                      <td style="padding: 8px; color: #6b7280;">${sahaAdi}</td>
                    </tr>
                    <tr style="background-color: #fef2f2;">
                      <td style="padding: 8px; font-weight: bold; color: #374151;">⚠️ Arıza:</td>
                      <td style="padding: 8px; color: #6b7280;">${arizaData.baslik}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; font-weight: bold; color: #374151;">📍 Konum:</td>
                      <td style="padding: 8px; color: #6b7280;">${arizaData.konum || 'Belirtilmemiş'}</td>
                    </tr>
                    <tr style="background-color: #fef2f2;">
                      <td style="padding: 8px; font-weight: bold; color: #374151;">🔴 Öncelik:</td>
                      <td style="padding: 8px; color: #6b7280;">${arizaData.oncelik || 'Normal'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; font-weight: bold; color: #374151;">📅 Tarih:</td>
                      <td style="padding: 8px; color: #6b7280;">${new Date().toLocaleString('tr-TR')}</td>
                    </tr>
                  </table>
                </div>
                
                ${arizaData.aciklama ? `
                <div style="margin: 15px 0;">
                  <strong style="color: #374151;">Açıklama:</strong>
                  <p style="color: #6b7280; margin: 5px 0; background-color: #f3f4f6; padding: 10px; border-radius: 4px;">
                    ${arizaData.aciklama}
                  </p>
                </div>
                ` : ''}
                
                <p style="color: #374151; margin-top: 20px;">
                  Teknik ekibimiz arıza üzerinde çalışmaya başlamıştır. Arıza durumu hakkında bilgilendirmeler bu e-posta adresine gönderilecektir.
                </p>
              </div>
              
              <div style="padding: 20px; text-align: center; background-color: #f3f4f6; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #6b7280; font-size: 12px;">
                  Bu e-posta ${companyName} tarafından otomatik olarak gönderilmiştir.
                </p>
              </div>
            </div>
          `
        };
        
        return transporter.sendMail(mailOptions);
      });
      
      await Promise.all(emailPromises);
      
      console.log(`✅ ${customersQuery.docs.length} müşteriye arıza bildirimi gönderildi`);
      return { success: true, message: `${customersQuery.docs.length} müşteriye bildirim gönderildi` };
      
    } catch (error) {
      console.error('❌ Müşteri arıza bildirimi gönderilemedi:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

// Müşterilere arıza durum güncelleme bildirimi
export const sendArizaStatusUpdateToCustomers = functions.firestore
  .document('arizalar/{arizaId}')
  .onUpdate(async (change, context) => {
    try {
      const newData = change.after.data();
      const oldData = change.before.data();
      const arizaId = context.params.arizaId;
      
      // Sadece durum değişikliğinde gönder
      if (newData.durum === oldData.durum) {
        return null;
      }
      
      console.log(`🔄 Arıza durum güncelleme müşteri bildirimi: ${arizaId}`);
      
      // Şirket bilgilerini al
      const companyDoc = await admin.firestore().doc(`companies/${newData.companyId}`).get();
      const companyName = companyDoc.exists ? companyDoc.data()?.name || 'SolarVeyo' : 'SolarVeyo';
      
      // Saha bilgilerini al
      let sahaAdi = 'Bilinmeyen Saha';
      if (newData.saha) {
        const sahaDoc = await admin.firestore().doc(`sahalar/${newData.saha}`).get();
        if (sahaDoc.exists) {
          sahaAdi = sahaDoc.data()?.ad || 'Bilinmeyen Saha';
        }
      }
      
      // Bu sahaya atanan müşterileri bul
      const customersQuery = await admin.firestore()
        .collection('kullanicilar')
        .where('rol', '==', 'musteri')
        .where('companyId', '==', newData.companyId)
        .where('sahalar', 'array-contains', newData.saha)
        .get();
      
      if (customersQuery.empty) {
        return { success: true, message: 'Müşteri bulunamadı' };
      }
      
      // Durum renkleri ve mesajları
      const durumBilgileri = {
        'acik': { renk: '#dc2626', emoji: '🚨', mesaj: 'Arıza tespit edildi ve işleme alındı' },
        'devam-ediyor': { renk: '#f59e0b', emoji: '🔧', mesaj: 'Arıza üzerinde çalışılıyor' },
        'beklemede': { renk: '#3b82f6', emoji: '⏳', mesaj: 'Arıza beklemede' },
        'cozuldu': { renk: '#16a34a', emoji: '✅', mesaj: 'Arıza başarıyla çözüldü' }
      };
      
      const durumInfo = durumBilgileri[newData.durum] || durumBilgileri['acik'];
      
      // E-posta gönderimi
      const transporter = nodemailer.createTransport({
        service: EMAIL_CONFIG.service,
        auth: EMAIL_CONFIG.auth
      });
      
      const emailPromises = customersQuery.docs.map(async (customerDoc) => {
        const customerData = customerDoc.data();
        
        const mailOptions = {
          from: EMAIL_CONFIG.auth.user,
          to: customerData.email,
          subject: `${durumInfo.emoji} Arıza Durum Güncelleme - ${sahaAdi}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: ${durumInfo.renk}; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">${durumInfo.emoji} Arıza Durum Güncelleme</h1>
              </div>
              
              <div style="padding: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb;">
                <h2 style="color: #1f2937; margin-top: 0;">Sayın ${customerData.ad},</h2>
                <p style="color: #374151;">Aşağıdaki arızanın durumu güncellenmiştir:</p>
                
                <div style="background-color: white; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px; font-weight: bold; color: #374151;">🏢 Saha:</td>
                      <td style="padding: 8px; color: #6b7280;">${sahaAdi}</td>
                    </tr>
                    <tr style="background-color: #f9fafb;">
                      <td style="padding: 8px; font-weight: bold; color: #374151;">⚠️ Arıza:</td>
                      <td style="padding: 8px; color: #6b7280;">${newData.baslik}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; font-weight: bold; color: #374151;">📍 Konum:</td>
                      <td style="padding: 8px; color: #6b7280;">${newData.konum || 'Belirtilmemiş'}</td>
                    </tr>
                    <tr style="background-color: #f9fafb;">
                      <td style="padding: 8px; font-weight: bold; color: #374151;">🔄 Eski Durum:</td>
                      <td style="padding: 8px; color: #6b7280;">${oldData.durum}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; font-weight: bold; color: #374151;">✨ Yeni Durum:</td>
                      <td style="padding: 8px; color: ${durumInfo.renk}; font-weight: bold;">${newData.durum}</td>
                    </tr>
                    <tr style="background-color: #f9fafb;">
                      <td style="padding: 8px; font-weight: bold; color: #374151;">📅 Güncelleme:</td>
                      <td style="padding: 8px; color: #6b7280;">${new Date().toLocaleString('tr-TR')}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p style="color: #0369a1; margin: 0; font-weight: bold;">
                    ${durumInfo.emoji} ${durumInfo.mesaj}
                  </p>
                </div>
                
                ${newData.durum === 'cozuldu' ? `
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p style="color: #166534; margin: 0; font-weight: bold;">
                    🎉 Harika haber! Arızanız başarıyla çözülmüştür. Sistemleriniz normal çalışmaya devam etmektedir.
                  </p>
                </div>
                ` : `
                <p style="color: #374151; margin-top: 15px;">
                  Arıza durumu hakkında güncellemeler bu e-posta adresine gönderilmeye devam edecektir.
                </p>
                `}
              </div>
              
              <div style="padding: 20px; text-align: center; background-color: #f3f4f6; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #6b7280; font-size: 12px;">
                  Bu e-posta ${companyName} tarafından otomatik olarak gönderilmiştir.
                </p>
              </div>
            </div>
          `
        };
        
        return transporter.sendMail(mailOptions);
      });
      
      await Promise.all(emailPromises);
      
      console.log(`✅ ${customersQuery.docs.length} müşteriye durum güncelleme bildirimi gönderildi`);
      return { success: true, message: `${customersQuery.docs.length} müşteriye durum güncelleme gönderildi` };
      
    } catch (error) {
      console.error('❌ Müşteri durum güncelleme bildirimi gönderilemedi:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }); 