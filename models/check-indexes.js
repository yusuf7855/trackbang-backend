// check-indexes.js - Duplicate index kontrolü

const fs = require('fs');
const path = require('path');

console.log('🔍 Duplicate index kontrolü başlatılıyor...');

const modelsDir = path.join(__dirname, 'models');
const modelFiles = fs.readdirSync(modelsDir).filter(file => file.endsWith('.js'));

console.log(`📁 ${modelFiles.length} model dosyası bulundu:`, modelFiles);

const problematicPatterns = [
  // Hem unique: true hem manuel index
  /(\w+):\s*{\s*[^}]*unique:\s*true[^}]*}/g,
  // Manuel index tanımları
  /\.index\(\s*{\s*[\'"]*(\w+)[\'"]*:\s*1\s*}\s*\)/g,
  // Schema içinde index: true
  /(\w+):\s*{\s*[^}]*index:\s*true[^}]*}/g
];

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  
  console.log(`\n📄 Analiz ediliyor: ${fileName}`);
  
  const uniqueFields = [];
  const manualIndexes = [];
  const schemaIndexes = [];
  
  // Unique fields bul
  let match;
  const uniqueRegex = /(\w+):\s*{\s*[^}]*unique:\s*true[^}]*}/g;
  while ((match = uniqueRegex.exec(content)) !== null) {
    uniqueFields.push(match[1]);
  }
  
  // Manuel index'leri bul
  const indexRegex = /\.index\(\s*{\s*[\'"]*(\w+)[\'"]*:\s*1\s*}\s*\)/g;
  while ((match = indexRegex.exec(content)) !== null) {
    manualIndexes.push(match[1]);
  }
  
  // Schema level index'leri bul
  const schemaIndexRegex = /(\w+):\s*{\s*[^}]*index:\s*true[^}]*}/g;
  while ((match = schemaIndexRegex.exec(content)) !== null) {
    schemaIndexes.push(match[1]);
  }
  
  // Duplicate'leri kontrol et
  const duplicates = [];
  
  uniqueFields.forEach(field => {
    if (manualIndexes.includes(field)) {
      duplicates.push({
        field: field,
        type: 'unique + manual',
        solution: `${field} için manuel .index() satırını kaldırın`
      });
    }
    if (schemaIndexes.includes(field)) {
      duplicates.push({
        field: field,
        type: 'unique + schema index',
        solution: `${field} için index: true kaldırın`
      });
    }
  });
  
  schemaIndexes.forEach(field => {
    if (manualIndexes.includes(field)) {
      duplicates.push({
        field: field,
        type: 'schema + manual',
        solution: `${field} için index: true veya manuel .index() kaldırın`
      });
    }
  });
  
  if (duplicates.length > 0) {
    console.log(`❌ ${fileName} dosyasında ${duplicates.length} duplicate index bulundu:`);
    duplicates.forEach(dup => {
      console.log(`   🔸 ${dup.field}: ${dup.type}`);
      console.log(`     💡 ${dup.solution}`);
    });
  } else {
    console.log(`✅ ${fileName} - Duplicate index sorunu yok`);
  }
  
  return {
    file: fileName,
    uniqueFields,
    manualIndexes,
    schemaIndexes,
    duplicates
  };
}

// Tüm model dosyalarını analiz et
const results = [];
modelFiles.forEach(file => {
  const filePath = path.join(modelsDir, file);
  try {
    const result = analyzeFile(filePath);
    results.push(result);
  } catch (error) {
    console.error(`❌ ${file} analiz edilemedi:`, error.message);
  }
});

// Özet rapor
console.log('\n' + '='.repeat(60));
console.log('📊 DUPLICATE INDEX RAPORU');
console.log('='.repeat(60));

const problematicFiles = results.filter(r => r.duplicates.length > 0);

if (problematicFiles.length > 0) {
  console.log(`\n❌ ${problematicFiles.length} dosyada sorun bulundu:`);
  
  problematicFiles.forEach(file => {
    console.log(`\n📄 ${file.file}:`);
    file.duplicates.forEach(dup => {
      console.log(`   - ${dup.field} (${dup.type})`);
    });
  });
  
  console.log('\n🔧 ÖNERİLEN ÇÖZÜMLER:');
  console.log('1. unique: true olan fieldlar için manuel .index() kaldırın');
  console.log('2. index: true olan fieldlar için ayrıca .index() tanımlamayın');
  console.log('3. Aynı field için hem unique hem index tanımlamayın');
  
} else {
  console.log('\n✅ Hiçbir dosyada duplicate index sorunu bulunamadı!');
}

console.log('\n🎯 MONGOOSE INDEX KURALLARI:');
console.log('- unique: true otomatik olarak index oluşturur');
console.log('- index: true otomatik olarak index oluşturur');
console.log('- Manuel .index() sadece complex index\'ler için kullanın');
console.log('- Aynı field için birden fazla index tanımlamayın');

module.exports = results;