// mongodb-index-cleanup.js
// MongoDB'daki duplicate index'leri temizleyen script

const mongoose = require('mongoose');

// MongoDB bağlantı URI'niz (app.js'teki ile aynı)
const MONGO_URI = "mongodb+srv://221118047:9KY5zsMHQRJyEwGq@cluster0.rz2m5a4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function cleanupDuplicateIndexes() {
  try {
    console.log('🔄 MongoDB\'ye bağlanılıyor...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB bağlantısı başarılı!');
    
    const db = mongoose.connection.db;
    
    // Tüm collection'ları listele
    const collections = await db.listCollections().toArray();
    console.log(`📊 ${collections.length} collection bulundu`);
    
    // Problem yaşayan collection'lar
    const problematicCollections = [
      'users',
      'devicetokens', 
      'messages',
      'payments',
      'storelistings',
      'playlists'
    ];
    
    for (const collectionName of problematicCollections) {
      console.log(`\n🔍 ${collectionName} collection'ını kontrol ediyorum...`);
      
      try {
        const collection = db.collection(collectionName);
        
        // Mevcut index'leri listele
        const indexes = await collection.indexes();
        console.log(`📋 ${collectionName} - ${indexes.length} index bulundu:`);
        
        // Index'leri analiz et
        const userIdIndexes = indexes.filter(idx => 
          JSON.stringify(idx.key).includes('userId') || 
          idx.name.includes('userId')
        );
        
        if (userIdIndexes.length > 1) {
          console.log(`⚠️ ${collectionName} - ${userIdIndexes.length} userId index'i bulundu:`);
          userIdIndexes.forEach(idx => {
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
          });
          
          // Manuel oluşturulan basit userId index'ini sil (eğer varsa)
          const simpleUserIdIndex = userIdIndexes.find(idx => 
            JSON.stringify(idx.key) === '{"userId":1}' && 
            idx.name === 'userId_1'
          );
          
          if (simpleUserIdIndex) {
            console.log(`🗑️ Basit userId index'ini siliyorum: ${simpleUserIdIndex.name}`);
            try {
              await collection.dropIndex(simpleUserIdIndex.name);
              console.log(`✅ ${simpleUserIdIndex.name} index'i silindi`);
            } catch (dropError) {
              console.log(`⚠️ Index silinemedi (muhtemelen zaten yok): ${dropError.message}`);
            }
          }
        } else {
          console.log(`✅ ${collectionName} - userId index problemi yok`);
        }
        
        // Diğer duplicate'ları kontrol et
        const duplicateNames = {};
        indexes.forEach(idx => {
          const keyStr = JSON.stringify(idx.key);
          if (duplicateNames[keyStr]) {
            duplicateNames[keyStr].push(idx.name);
          } else {
            duplicateNames[keyStr] = [idx.name];
          }
        });
        
        // Duplicate'ları raporla
        Object.entries(duplicateNames).forEach(([key, names]) => {
          if (names.length > 1) {
            console.log(`⚠️ Duplicate index bulundu ${key}:`);
            names.forEach(name => console.log(`   - ${name}`));
          }
        });
        
      } catch (error) {
        console.log(`❌ ${collectionName} işlenirken hata: ${error.message}`);
      }
    }
    
    console.log('\n🎯 INDEX TEMİZLEME TAMAMLANDI!');
    console.log('\n💡 ÖNERİLER:');
    console.log('1. Server\'ı yeniden başlatın');
    console.log('2. Yeni model dosyalarını kullandığınızdan emin olun');
    console.log('3. Eğer hâlâ warning alıyorsanız, --trace-warnings ile detay alın');
    
  } catch (error) {
    console.error('❌ Script hatası:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔐 MongoDB bağlantısı kapatıldı');
    process.exit(0);
  }
}

// Script'i çalıştır
cleanupDuplicateIndexes().catch(console.error);