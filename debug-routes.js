// debug-routes.js - Bu dosyayı backend klasöründe oluşturun ve çalıştırın

const express = require('express');

console.log('🔍 Route dosyalarını tek tek test ediyorum...\n');

const routeFiles = [
  './routes/authRoutes',
  './routes/musicRoutes', 
  './routes/playlistRoutes',
  './routes/downloadRoutes',
  './routes/sampleRoutes',
  './routes/hotRoutes',
  './routes/searchRoutes',
  './routes/notificationRoutes',
  './routes/storeRoutes'
];

async function testRoutes() {
  for (const routeFile of routeFiles) {
    try {
      console.log(`📂 Test ediliyor: ${routeFile}`);
      
      // Yeni bir express app oluştur
      const testApp = express();
      
      // Route'u yükle
      const route = require(routeFile);
      
      // Route'u test app'e ekle
      testApp.use('/test', route);
      
      console.log(`✅ ${routeFile} - BAŞARILI`);
      
    } catch (error) {
      console.error(`❌ ${routeFile} - HATA:`, error.message);
      console.error(`📍 Stack trace:`, error.stack);
      
      // Bu route'da path-to-regexp hatası varsa detayları göster
      if (error.message.includes('Missing parameter name')) {
        console.error(`🚨 PATH-TO-REGEXP HATASI BULUNDU: ${routeFile}`);
        console.error(`🔍 Bu dosyadaki route tanımlarını kontrol edin:`);
        console.error(`   - Boş parametre isimleri (/: yerine /:paramName)`);
        console.error(`   - Çift iki nokta (:: yerine :)`);
        console.error(`   - Geçersiz wildcard kullanımı`);
      }
    }
    
    console.log(''); // Boş satır
  }
}

testRoutes().then(() => {
  console.log('🎯 Test tamamlandı!');
  console.log('💡 Hatalı routeu bulduktan sonra, o dosyayı açıp route tanımlarını kontrol edin.');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test scripti hatası:', error);
  process.exit(1);
});