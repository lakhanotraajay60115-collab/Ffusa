const CACHE_NAME = 'akshar-game-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // અહીં તમારી બધી CSS, JS અને Images ની ફાઇલો ઉમેરો
  // દા.ત.: '/css/style.css',
  // આ ઉદાહરણમાં આપણે માત્ર મુખ્ય ફાઇલો જ રાખીશું
  '/socket.io/socket.io.js'
];

// ઇન્સ્ટોલેશન: કેશમાં ફાઇલો ઉમેરો
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// ફેચ (Fetch): કેશમાંથી રિસ્પોન્સ પરત કરો
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // જો કેશમાં હોય, તો તે પરત કરો
        if (response) {
          return response;
        }
        // જો કેશમાં ન હોય, તો નેટવર્ક પરથી ફેચ કરો
        return fetch(event.request);
      })
  );
});
