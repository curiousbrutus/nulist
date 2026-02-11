
import { executeQuery, executeNonQuery, initializePool } from '../src/lib/oracle';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_DATA = `171		Çerkezköy iş listesi	"Arşiv sürecinin gözden geçirilmesi 
Su basması
Fiziksel şartların iyileştirilmesi
Çalışılan firma ile düzenli toplantılar,
Bölüm dışında kalan dosyalar,
Tıbbi kayıtların güvenli alanda bulunması,
Prosedürün gözden geçirilmesi,"	"Filiz Albayrak
Demet Ersoy"	Elçin Süleymanoğlu	1.04.2025	1- Arşiv işleyiş süreci tıbbi kayıt kurulunda gözden geçirilmektedir. 2- Su basması için kum torbalarımız mevcut.() 3- Arşivin taşınması teklif edildi (25.02.2026). 4- 6 ayda bir firmayı ziyaret ederek tedarikçi değerlendirilmesi yapılıyor. 5- Hasta dosyaları, arşiv teslimleri Bizmed üzerinden yapılmaya başlandı. (Bizmedden veri çekebilmek için Eyyüb bey bu durumu not aldı). 6- Arşive gelen kayıtlar güvenli alandadır. 1 tane daha kum torbası temin edilecektir. 7- Filiz hanım gözden geçirmektedir.	26.01.2026	Devam
186		Çerkezköy iş listesi	" Dış kaynak kullanımı yolu ile sunulan hizmetlerin Sağlıkta Akreditasyon Standartlarına uygun olması sağlanmalıdır.:
Sunulan hizmetlerin SAS kriterlerine uygun olarak hizmet bazlı kontrol kriterleri ve performans göstergeleri tanımlanmamıştı. Genel olarak tanımlanmış olan bir form ile yapılmış değerlendirmeler mevcut olmakla birlikte alınan 14 farklı hizmette hizmetin yapısı ve SAS kriterlerine göre geliştirilmiş bir süreç mevcut değildi. Ölçütün gereklilikleri doğrultusunda sürecin geliştirilmesi gerekliliği hastane tarafından da kabul edildi."	Tüm Yöneticiler	Tüm Yöneticiler	1.04.2025	bu sorular Bizmede yüklendi, fakat değerlendirmeler Bizmed'de bulunamadı, yetkiler(?) veya erkanın kendisiyle alakalı problemlere bakılacak (Filiz hanım)	31.01.2026	Devam
229		Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	"Acil müdehale odasının da dışardan görünmemesi için yapılan giydirmelerde yer yer açılmalar olduğu için
oranın giydirmesi de onarıma gidecek."	Merve Ağdağlı	Elçin Süleymanoğlu	28.02.2026	alternatif bir şey değerlendirilecek. --duruyor, bu hafta yapılacak		Devam
256		Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Su bastı raporu İnternational şube için de hazırlanacak.	Çağatay Şen	Elçin Süleymanoğlu	1.04.2025	Kaliteye 25 su bastı raporu iletildi		Devam
276		Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	venöz tromboemboli formunun hatırlatmaları ve geriye dönük kontrollerinin yapılması	Demet Ersoy	Çetin Üçecam	28.02.2026	formun bizmed den kullanılabilir hale gelmesi bekleniyor manuel olarak hekimlere doldurmaları hatırlatılıyor. Hekim toplantılarında tekrardan hatırlatılması gerekiyor. SAS toplantısında hekimlere bilgi verildi		Devam
279		Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Acil hekimlerine Bizmed eğitimi verilecek.Hekimlerin verileri girişleri izlenecek.	Metin Çakmak	Çetin Üçeçam				Devam
281	14.06.2025	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Acilin para kaybı ve işleyişte revizyona gidilmesi 	Arzu Ceren Tuna	Elçin süleymanoğlu	28.02.2028	Taburcu kartları kullanılmaya başlandı, sahada sürecin tam uygulanabilir olduğundan emin olunacak. Ocak Şubay kıyaslaması beklenmektedir.		Devam
294	10.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Tesiste var olan su deposunun izole edilmesine karar verildi.	Uğur Duran	Elçin Süleymanoğlu	7.02.2026	İşleme başlandı, iş takip ediliyor.		Devam
295	10.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Eczane raflarının dolap olarak revizyonu istenmiştir.	Uğur Duran, Gülay Erdağ	Elçin Süleymanoğlu	28.02.2026	İşleme başlandı, iş takip ediliyor.		Devam
323	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Eksi 2 laboratuvar ve radyoloji dahili hoparlörlerin kontrol edilmesi	Çağatay Şen	Uğur Duran	31.01.2026			Devam
324	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	AACI belgesinin 19 Mart'a kadar yenilenmemesi üzerine hastaneden ve sosyal medyadan sembolleri ve işaretlerin kaldırılması gerekiyor.	Merve Ağdağlı	Elçin Süleymanoğlu	07.02.2026			Devam
325	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Deponun girişindeki rampanın düzeltilmesi	Çağatay Şen	Hasan Nergisli	15.02.2026			Devam
326	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Odalardaki eksik kıble işaretlerinin tamamlanması	Çağatay Şen	Hatice Şahin	07.02.2026			Devam
327	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Gece temizliği ve personel planlamasının düzenlenmesi	Hatice Şahin, Elçin Esen Eşiyok	Elçin Süleymanoğlu	31.01.2026			Devam
328	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Her birim yöneticisinin kendi işleyişiyle ilgili prosedürleri gözden geçirip güncel ve sahada uygulanabilir olduğundan emin olunması ve eğitimlerde okutulması. Birim prosedürlerinin NotebookLM ile video eğitimi yapılması. Prosedür yazma eğitimi de verilecektir.	Eyyüb Güven, Filiz Albayrak, Tüm Yöneticiler	Tüm Yöneticiler	15.02.2026			Devam
329	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Telefonlara gelen maillerin içeriğinin görünmemesi üzerine revizyon.	Metin Çakmak	Elçin Süleymanoğlu	07.02.2026			Devam
330	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Kullanılamaz durumda olan yatakların belirlenerek yenisinin temin edilmesi. Çıkarılan yatakların da tamir edilerek yedekte tutulması.	Buse Hanım	Biyomedikal	31.01.2026			Devam
331	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Yatak modülleri için firmaya gidilmesi	Buse Rahvan	Uğur Duran	31.01.2026			Devam
332	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Kliniklerde bulunan ilaç dolaplarının elektrik kesintisinden etkilenmemesi için 4 adet küçük UPS alınarak desteklenmesi	Çağatay Şen	Gülay Erdağ	15.02.2026			Devam
333	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Su, aydınlatma, kesintisiz güç kaynağı gibi sistemler sterilizasyon güvenliğini sağlayacak şekilde planlanmalı ve izlenmelidir. (Otoklavın UPS'e bağlanması ?)	Çağatay Bey	Teknik Servis	28.02.2026			Devam
334	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Sulu alan priz kontrolleri	Çağatay Bey	Eyyüb Güven	07.02.2026			Devam
335	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	İşe başlayan bütün doktorların bilgi işlem tarafından Bizmed eğitimleri verilmeli. Bütün birimlerde aynı prosedürün işlediğinden emin olunmalı.	Metin Çakmak	Elçin Süleymanoğlu	28.02.2026			Devam
336	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Polikliniklerde ki protokol defterlerinin e-imza düzeni kontrolü sağlanmalıdır.	Metin Çakmak	Elçin Süleymanoğlu	07.02.2026			Devam
337	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Mevcut İş takip listesi projelerin aktif edilmesi.	Eyyüb Güven, Fatih Sak	Elçin Süleymanoğlu	7.02.2026			Devam
338	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	8. kat sistem odası ve bilgi işlem odasının düzenlenmesi	Metehan Ceylan, Hüseyin Aydın	Elçin Süleymanoğlu	15.02.2026			Devam
339	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Hasta odalarındaki paslanmış armatürlerin ve ekipmanların kontrolünün yapılarak değiştirilmesinin sağlanması ve periyodik bir şekilde takibinin sağlanması.	Hatice Şahin	Eyyüb Güven	07.02.2026			Devam
340	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Hastane genelinde bulunan kırık camlı kapıların tespit edilip değiştirilmesi	Çağatay Şen	Uğur Duran	28.02.2026			Devam
341	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Yoğun bakım 2.kapısının yatak geçişi için uygun hale getirilmesi. (Şu an elle açılıyor)	Çağatay Şen	Uğur Duran	7.02.2026			Devam
342	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Radyoloji ve kan alma alanlarına numaratör konulacak.	Çağatay Şen, Metehan Ceylan	Eyyüb Güven	15.02.2026			Devam
343	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Hekimlerin e-imza yaptıktan sonra epikrizde düzeltme yapıp yapamadığı kontrol edilecek. Anlaşmalı kurumlar tarafından güncel epikrizin yüklenip yüklenmediği kontrol edilecek.	Fatih Sak, Nazlı Sevilmiş	Elçin Süleymanoğlu	31.01.2026			Devam
344	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Depo malzemelerinin yeni ofislerin ön girişindeki boş depoya taşınması, kullanılmayan malzemelerin bir araya toplanması ve imha edilmesi.	Hasan Nergisli, Çağatay Şen, Nagihan Avcı, Hüseyin Aydın	Elçin Süleymanoğlu	07.02.2026			Devam
345	24.01.2026	Çorlu Optimed Hastanesi İşletmenin Yönetimi İş Listesi	Çamaşırhane, Teknik Servis ve Biyomedikal için konteyner temini	Elçin Süleymanoğlu	Elçin Süleymanoğlu, Gülay Erdağ	28.02.2026			Devam`;

function normalizeName(name: string): string {
    return name.trim().toLowerCase()
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ş/g, 's')
        .replace(/ü/g, 'u');
}

function parseDate(dateStr: string): Date | null {
    if (!dateStr || !dateStr.includes('.')) return null;
    const parts = dateStr.trim().split('.');
    if (parts.length !== 3) return null;
    // expects d.m.yyyy or dd.mm.yyyy
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
}

async function run() {
    await initializePool();
    
    // 1. Fetch Users
    const users = await executeQuery('SELECT id, full_name, email FROM profiles');
    const userMap = new Map<string, any>();
    
    users.forEach((u: any) => {
        // Map email prefix to user
        const prefix = u.email.split('@')[0];
        userMap.set(prefix, u);
        // Map full name normalized
        userMap.set(normalizeName(u.full_name), u);
    });

    // Add manual override for "Çağatay Bey" or others if tricky
    const cagatay = userMap.get(normalizeName('Çağatay Şen'));
    if (cagatay) userMap.set(normalizeName('Çağatay Bey'), cagatay);
    
    const buse = userMap.get(normalizeName('Buse Rahvan'));
    if (buse) userMap.set(normalizeName('Buse Hanım'), buse);


    const lists = await executeQuery('SELECT id, title FROM lists');
    const folders = await executeQuery('SELECT id, title FROM folders');
    let folderId = '';
    
    if (folders.length > 0) {
        folderId = folders[0].id;
    } else {
        folderId = uuidv4();
        await executeNonQuery(`
            INSERT INTO folders (id, title, user_id)
            VALUES (:id, :title, '3209a416-01af-468a-a08e-8c46dd9bfd26')
        `, { id: folderId, title: 'Imported Tasks' });
        console.log('Created new folder for imports');
    }

    const listMap = new Map<string, string>();
    lists.forEach((l: any) => {
        listMap.set(l.title.trim().toLowerCase(), l.id);
    });

    const rows = RAW_DATA.split('\n').filter(l => l.trim().length > 0);
    
    for (const row of rows) {
        // Use a regex for tab-separated that handles quoted blocks
        // Simple tabs split might fail if quotes contain tabs, but unlikely here.
        // There are newlines inside quotes. 
        // We cannot just split by line, we need to consume the string.
        // Actually, my RAW_DATA string is already split by lines which breaks the multi-line fields!
        // I need to rejoin and parse properly or fix the raw data.
        // The RAW DATA above has newlines inside string literals which are valid in JS backtick string.
        // But `split('\n')` WILL break the quoted fields.
    }
    
    // Parsing correctly:
    // Regex to match lines that start with a number (SIRA)
    const entryRegex = /^\d+\s+/gm;
    // This is hard because a line might not start with number?
    // Actually all lines start with a number in the provided sample.
    // Let's iterate manually.
    
    let entries: string[] = [];
    let currentEntry = '';
    const lines = RAW_DATA.split('\n');
    
    for (const line of lines) {
       if (/^\d+(\t|\s)/.test(line)) {
           if (currentEntry) entries.push(currentEntry);
           currentEntry = line;
       } else {
           currentEntry += '\n' + line;
       }
    }
    if (currentEntry) entries.push(currentEntry);

    console.log(`Found ${entries.length} entries.`);

    for (const entry of entries) {
        // Now split by tab
        // Some columns might be empty tabs. 
        // Be careful with quotes.
        
        // Custom split function for potential quotes
        const parts: string[] = [];
        let currentPart = '';
        let inQuote = false;
        
        for (let i = 0; i < entry.length; i++) {
            const char = entry[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === '\t' && !inQuote) {
                parts.push(currentPart);
                currentPart = '';
            } else {
                currentPart += char;
            }
        }
        parts.push(currentPart);
        
        // Clean up quotes
        const cols = parts.map(p => p.trim().replace(/^"|"$/g, ''));
        
        // Map Columns (Based on visual inspection):
        // 0: SIRA
        // 1: İŞİN ATANDIĞI TARİH (Date Assigned) - often empty
        // 2: İŞİN BELİRLENDİĞİ TOPLANTI (Meeting)
        // 3: YAPILACAK İŞ (Work/Title)
        // 4: İŞİN BİRİNCİL SORUMLUSU (Primary)
        // 5: İŞİN İKİNCİL SORUMLUSU (Secondary)
        // 6: TERMİN TARİHİ (Due Date)
        // 7: AÇIKLAMA (Description/Notes)
        // 8: BİTİŞ TARİHİ
        // 9: DURUMU
        
        const SIRA = cols[0];
        const TODO = cols[3];
        const PRIMARY = cols[4];
        const SECONDARY = cols[5];
        const DUE_DATE_STR = cols[6];
        const NOTES = cols[7];
        
        if (!TODO) continue;

        // Title and Description
        const todoLines = TODO.split('\n');
        const title = todoLines[0].substring(0, 200); // Truncate
        const description = TODO + (NOTES ? `\n\nNotlar: ${NOTES}` : '');
        
        const dueDate = parseDate(DUE_DATE_STR);
        
        // Find Owners
        const ownerNames = [
            ...(PRIMARY ? PRIMARY.split(/,|\n|ve\s/g) : []),
            ...(SECONDARY ? SECONDARY.split(/,|\n|ve\s/g) : [])
        ].map(n => n.trim()).filter(n => n && n !== 'Tüm Yöneticiler' && n !== 'Teknik Servis' && n !== 'Biyomedikal');
        
        // Unique owners
        const matchedUserIds = new Set<string>();
        
        for (const name of ownerNames) {
            const cleaned = normalizeName(name);
            const user = userMap.get(cleaned);
            if (user) {
                matchedUserIds.add(user.id);
            } else {
                // Try fuzzy? Manual map?
                // Try removing last name
                // Ignore for now and log
                console.warn(`User not found: ${name} (Normalized: ${cleaned})`);
            }
        }
        
        if (matchedUserIds.size === 0) {
            console.log(`Skipping task ${SIRA} - No valid assignees`);
            continue;
        }

        const listName = cols[2];
        let listId = '';
        
        if (listName) {
            const normalizedList = listName.trim().toLowerCase();
            listId = listMap.get(normalizedList) || '';
            
            if (!listId) {
                // Create list
                listId = uuidv4();
                await executeNonQuery(`
                    INSERT INTO lists (id, title, folder_id)
                    VALUES (:id, :title, :folder_id)
                `, { id: listId, title: listName.trim(), folder_id: folderId });
                listMap.set(normalizedList, listId);
                console.log(`Created new list: ${listName}`);
            }
        } else {
             // Fallback default list
             const defaultTitle = 'Genel Görevler';
             const normalizedDefault = defaultTitle.toLowerCase();
             listId = listMap.get(normalizedDefault) || '';
             if (!listId) {
                 listId = uuidv4();
                 await executeNonQuery(`
                    INSERT INTO lists (id, title, folder_id)
                    VALUES (:id, :title, :folder_id)
                `, { id: listId, title: defaultTitle, folder_id: folderId });
                listMap.set(normalizedDefault, listId);
                console.log(`Created default list: ${defaultTitle}`);
             }
        }

        // Create Task
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        await executeNonQuery(`
            INSERT INTO tasks (id, title, notes, due_date, priority, status, created_by, list_id)
            VALUES (:bv_id, :bv_title, :bv_notes, :bv_due_date, 'Orta', 'TODO', '3209a416-01af-468a-a08e-8c46dd9bfd26', :bv_list_id)
        `, {
            bv_id: taskId,
            bv_title: title,
            bv_notes: description,
            bv_due_date: dueDate,
            bv_list_id: listId
        });
        
        // Add Assignees
        for (const uid of matchedUserIds) {
            await executeNonQuery(`
                INSERT INTO task_assignees (task_id, user_id) VALUES (:bv_tid, :bv_uid)
            `, { bv_tid: taskId, bv_uid: uid });
            
            // Enable Sync
             await executeNonQuery(`
                 UPDATE profiles SET zimbra_sync_enabled = 1 WHERE id = :bv_uid
             `, { bv_uid: uid });
             
             // Get Email
             const user = Array.from(userMap.values()).find(u => u.id === uid);
             
             // Queue Sync
             if (user) {
                 await executeNonQuery(`
                    INSERT INTO sync_queue (id, task_id, user_email, action_type, payload, status)
                    VALUES (:bv_qid, :bv_tid, :bv_email, 'CREATE', :bv_payload, 'PENDING')
                 `, {
                     bv_qid: uuidv4(),
                     bv_tid: taskId,
                     bv_email: user.email,
                     bv_payload: JSON.stringify({
                         title: title,
                         notes: description,
                         due_date: dueDate,
                         priority: 'Orta',
                         status: 'NEEDS-ACTION'
                     })
                 });
                 console.log(`Queued sync for ${user.email}`);
             }
        }
        console.log(`Imported task ${SIRA}: ${title}`);
    }
    
    console.log("Import Complete");
    process.exit(0);
}

run();
