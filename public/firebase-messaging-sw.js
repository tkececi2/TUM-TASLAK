importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAZdHmOkHazCMnRZuZ6STP17wjG4QMHaxk",
  authDomain: "yenisirket-2ec3b.firebaseapp.com",
  projectId: "yenisirket-2ec3b",
  storageBucket: "yenisirket-2ec3b.firebasestorage.app",
  messagingSenderId: "155422395281",
  appId: "1:155422395281:web:b496b7e93ae3d0a280a830"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});