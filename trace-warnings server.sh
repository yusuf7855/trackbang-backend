# trace-duplicate-warnings.sh
# Duplicate index hatalarını detaylı olarak tespit eder

echo "🔍 Duplicate index warning'lerini detaylı tespit ediyorum..."

# 1. Trace warnings ile server'ı başlat ve logla
echo "📊 Server'ı trace mode'da başlatıyorum..."
timeout 10s node --trace-warnings app.js > trace-output.log 2>&1 &
APP_PID=$!

# 10 saniye bekle
sleep 10

# Process'i öldür (eğer hâlâ çalışıyorsa)
kill $APP_PID 2>/dev/null || true

# 2. Log'u analiz et
echo ""
echo "📋 TRACE ANALIZI:"
echo "=================="

if [ -f trace-output.log ]; then
  # Duplicate warnings'leri filtrele
  echo "⚠️ DUPLICATE INDEX WARNING'LERİ:"
  grep -n "Duplicate schema index" trace-output.log
  
  echo ""
  echo "📍 STACK TRACE'LER:"
  # Stack trace'leri göster
  grep -A 15 "Duplicate schema index" trace-output.log
  
  echo ""
  echo "🔍 DOSYA REFERANSLARI:"
  # Hangi dosyalardan geldiğini bul
  grep -E "(models/|\.js:)" trace-output.log | head -20
  
else
  echo "❌ trace-output.log dosyası bulunamadı"
fi

echo ""
echo "💡 MANUEL KONTROL:"
echo "=================="

# 3. Model dosyalarında googlePlayToken ara
echo "🔍 googlePlayToken index'lerini arıyorum:"
grep -r "googlePlayToken" models/ --include="*.js" -n

echo ""
echo "🔍 userId index tanımlarını arıyorum:"
grep -r "userId.*index" models/ --include="*.js" -n

echo ""
echo "🔍 .index.*userId tanımlarını arıyorum:"  
grep -r "\.index.*userId" models/ --include="*.js" -n

echo ""
echo "📂 Payment.js dosyalarını listele:"
find . -name "*Payment*" -type f

echo ""
echo "🎯 ÖNERİ: Yukarıdaki sonuçlara göre duplicate index'leri düzelt!"