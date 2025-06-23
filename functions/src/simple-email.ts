import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import * as nodemailer from 'nodemailer';

// Initialize Firebase Admin with default settings
admin.initializeApp();

// Email configuration
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: 'tolgatkececi@gmail.com', // Kendi Gmail adresinizi yazın
    pass: 'BURAYA-GMAIL-APP-PASSWORD-YAZIN' // Gmail app password'ünüzü yazın
  }
};

// Admin email to receive notifications
const ADMIN_EMAIL = 'tolgatkececi@gmail.com'; // Bildirimlerin geleceği e-posta adresinizi yazın

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