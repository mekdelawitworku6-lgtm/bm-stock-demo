/* Firebase Cloud Messaging service worker for BM Stock web push. */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAzTsr7j-KODQkh5ouajc5BFnSsUKK3Ywo',
  appId: '1:109507036406:web:bmstock',
  messagingSenderId: '109507036406',
  projectId: 'bmstock-bc004',
  storageBucket: 'bmstock-bc004.firebasestorage.app',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'BM Stock';
  const body = payload.notification?.body || '';
  const options = {
    body,
    icon: '/icons/Icon-192.png',
    badge: '/icons/Icon-192.png',
    data: payload.data || {},
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
