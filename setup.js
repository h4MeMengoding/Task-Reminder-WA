/**
 * Fungsi utama untuk melakukan setup awal sistem multi-user
 * Fungsi ini akan membuat sheet USERS dan mengkonversi data dari setup lama
 */
function setupMultiUser() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetSetup = ss.getSheetByName("SETUP");
    
    if (!sheetSetup) {
        throw new Error("Sheet SETUP tidak ditemukan!");
    }
    
    // Periksa dan buat template sheets jika belum ada
    createTemplateSheets();
    
    // Cek apakah sheet USERS sudah ada
    var userSheet = ss.getSheetByName("USERS");
    if (userSheet) {
        var ui = SpreadsheetApp.getUi();
        var response = ui.alert(
            'Peringatan',
            'Sheet USERS sudah ada. Lanjutkan setup? (Data lama akan dipertahankan)',
            ui.ButtonSet.YES_NO
        );
        
        if (response != ui.Button.YES) {
            return "Setup dibatalkan oleh pengguna";
        }
    } else {
        // Buat sheet USERS baru
        createUserSheet();
        userSheet = ss.getSheetByName("USERS");
    }
    
    // Buat menu kustom
    createCustomMenu();
    
    return "✅ Setup multi-user berhasil dilakukan!\n\n" +
           "Template sheets (TEMPLATE_TUGAS dan TEMPLATE_DONE) telah disiapkan.\n" +
           "Sheet USERS telah dibuat dengan data pengguna awal dari sheet SETUP.\n\n" +
           "Untuk menambahkan pengguna baru:\n" +
           "1. Gunakan perintah !user tambah/628123456789/Nama User/calendar_id@gmail.com\n" +
           "2. Atau tambahkan secara manual di sheet USERS\n\n" +
           "Menu Admin telah ditambahkan di menu utama spreadsheet.";
}

/**
 * Fungsi untuk membuat menu kustom pada spreadsheet
 */
function createCustomMenu() {
    var ui = SpreadsheetApp.getUi();
    var menu = ui.createMenu('📱 Admin Reminder');
    
    menu.addItem('🔄 Setup Multi-User', 'setupMultiUser')
        .addSeparator()
        .addItem('📑 Buat Template Sheets', 'createTemplateSheets')
        .addSeparator()
        .addItem('👤 Verifikasi Admin User', 'verifyAdminUser')
        .addItem('🩺 Diagnosa Masalah Admin', 'diagnoseAdminIssues')
        .addSeparator()
        .addItem('📅 Setup Calendar', 'setupCalendarConfig')
        .addItem('🔃 Sync Tasks to Calendar', 'syncAllTasksToCalendar')
        .addSeparator()
        .addItem('⚡ Create Edit Trigger', 'createEditTrigger')
        .addItem('⏰ Setup WhatsApp Trigger', 'setTriggerKirimWA')
        .addSeparator()
        .addItem('🔍 Diagnosa Masalah Calendar', 'diagnoseCalendarIssues')
        .addItem('🛠️ Perbaiki Sinkronisasi Calendar', 'fixAllUserCalendarSync')
        .addItem('🧹 Bersihkan Event ID Tidak Valid', 'cleanupInvalidEventIds')
        .addToUi();
}

/**
 * Fungsi untuk migrasi data dari sistem lama ke sistem multi-user
 */
function migrateOldData() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var oldReminderSheet = ss.getSheetByName("REMINDER");
    var oldDoneSheet = ss.getSheetByName("DONE");
    var sheetSetup = ss.getSheetByName("SETUP");
    
    if (!oldReminderSheet || !oldDoneSheet) {
        throw new Error("Sheet REMINDER atau DONE tidak ditemukan!");
    }
    
    // Ambil user default dari SETUP
    var defaultWhatsApp = sheetSetup.getRange("C3").getValue();
    var defaultName = sheetSetup.getRange("C2").getValue();
    
    if (!defaultWhatsApp) {
        throw new Error("Nomor WhatsApp tidak ditemukan di sheet SETUP!");
    }
    
    // Cek apakah user sudah ada di sheet USERS
    var user = getUser(defaultWhatsApp);
    if (!user) {
        // Tambahkan user jika belum ada
        var calendarId = sheetSetup.getRange("C11").getValue();
        addNewUser(defaultWhatsApp, defaultName, calendarId);
        user = getUser(defaultWhatsApp);
    }
    
    // Cek sheet reminder dan done untuk user ini
    var userReminderSheet = getSheetForUser(defaultWhatsApp, "reminder");
    var userDoneSheet = getSheetForUser(defaultWhatsApp, "done");
    
    // Salin data dari sheet lama ke sheet user
    if (userReminderSheet.getName() !== "REMINDER") { // Hanya jika sheet berbeda
        // Copy data dari REMINDER ke sheet user
        var dataRange = oldReminderSheet.getRange(10, 2, 31, 4).getValues();
        userReminderSheet.getRange(10, 2, 31, 4).setValues(dataRange);
    }
    
    if (userDoneSheet.getName() !== "DONE") { // Hanya jika sheet berbeda
        // Copy data dari DONE ke sheet user
        var doneDataRange = oldDoneSheet.getRange(10, 2, 31, 3).getValues();
        userDoneSheet.getRange(10, 2, 31, 3).setValues(doneDataRange);
    }
    
    // Update Event ID untuk mengganti format lama ke format baru
    migrateCalendarEventIds(defaultWhatsApp);
    
    return "✅ Migrasi data berhasil!\n\n" +
           "Data dari sheet REMINDER dan DONE telah disalin ke sheet user " + defaultName + ".\n\n" +
           "Sistem sekarang siap digunakan dengan fitur multi-user.";
}

/**
 * Fungsi untuk memastikan user admin terdaftar dan valid
 * Ini bisa dijalankan secara manual untuk memperbaiki masalah dengan admin
 */
function verifyAdminUser() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetSetup = ss.getSheetByName("SETUP");
    var userSheet = ss.getSheetByName("USERS");
    
    if (!userSheet) {
        Logger.log("Sheet USERS tidak ditemukan, membuat sheet baru...");
        createUserSheet();
        userSheet = ss.getSheetByName("USERS");
    }
    
    // Ambil informasi admin
    var adminNumber = sheetSetup.getRange("C3").getValue().toString().trim();
    var adminName = sheetSetup.getRange("C2").getValue();
    var calendarId = sheetSetup.getRange("C11").getValue();
    
    Logger.log("👤 Admin dari SETUP: '" + adminNumber + "'");
    
    if (!adminNumber) {
        throw new Error("Nomor admin tidak ditemukan di sheet SETUP!");
    }
    
    // Cari admin di data users dengan pengecekan lebih ketat
    var data = userSheet.getDataRange().getValues();
    var adminFound = false;
    var adminRow = -1;
    
    for (var i = 1; i < data.length; i++) {
        var currentNumber = data[i][0].toString().trim();
        Logger.log("Membandingkan: '" + currentNumber + "' dengan '" + adminNumber + "'");
        
        if (currentNumber === adminNumber) {
            // Admin ditemukan, update data jika perlu
            adminRow = i + 1;
            adminFound = true;
            Logger.log("Admin ditemukan di baris " + adminRow);
            break;
        }
    }
    
    // Jika admin tidak ditemukan, tambahkan ke sheet USERS
    if (!adminFound) {
        Logger.log("Admin tidak ditemukan, menambahkan ke sheet USERS...");
        var lastRow = userSheet.getLastRow() + 1;
        userSheet.getRange(lastRow, 1, 1, 5).setValues([
            [adminNumber, adminName || "Admin", calendarId || "", "REMINDER", "DONE"]
        ]);
        Logger.log("Admin ditambahkan di baris " + lastRow);
    } else {
        // Update data admin jika ditemukan
        userSheet.getRange(adminRow, 2, 1, 4).setValues([
            [adminName || "Admin", calendarId || "", "REMINDER", "DONE"]
        ]);
        Logger.log("Data admin diperbarui di baris " + adminRow);
    }
    
    // Migrasi event ID untuk admin jika belum dilakukan
    migrateCalendarEventIds(adminNumber);
    
    // Tambahkan pengecekan akses langsung setelah verifikasi
    var adminTest = getUser(adminNumber);
    if (!adminTest) {
        Logger.log("🚨 PERHATIAN: Admin masih tidak terdeteksi setelah verifikasi!");
        // Coba sekali lagi dengan FORCE
        var forceRegister = userSheet.getRange(userSheet.getLastRow() + 1, 1, 1, 5).setValues([
            [adminNumber, adminName || "Admin", calendarId || "", "REMINDER", "DONE"]
        ]);
        Logger.log("🔥 Force register admin dilakukan");
    } else {
        Logger.log("✓ Admin berhasil diverifikasi dan terdeteksi oleh sistem");
    }
    
    var result = "✅ User admin berhasil diverifikasi dan diperbarui";
    Logger.log(result);
    return result;
}

/**
 * Fungsi untuk migrasi event ID calendar dari format lama ke format baru
 */
function migrateCalendarEventIds(whatsappNumber) {
    Logger.log("🔄 Migrasi event ID untuk user: " + whatsappNumber);
    
    var eventIds = PropertiesService.getScriptProperties().getProperty('eventIds');
    if (!eventIds) {
        Logger.log("Tidak ada event ID yang tersimpan");
        return;
    }
    
    eventIds = JSON.parse(eventIds);
    var newEventIds = {};
    var migrationCount = 0;
    
    // Salin semua ID yang sudah dalam format baru
    for (var taskId in eventIds) {
        if (taskId.split("_").length > 2) {
            // Sudah dalam format baru (TASK_number_row)
            newEventIds[taskId] = eventIds[taskId];
        }
    }
    
    // Konversi format lama ke format baru
    for (var oldTaskId in eventIds) {
        // Format lama adalah TASK_row (hanya memiliki 1 underscore)
        if (oldTaskId.split("_").length === 2) {
            var row = oldTaskId.split("_")[1];
            var newTaskId = "TASK_" + whatsappNumber + "_" + row;
            
            // Hindari duplikasi jika sudah ada dalam format baru
            if (!newEventIds[newTaskId]) {
                newEventIds[newTaskId] = eventIds[oldTaskId];
                migrationCount++;
            }
        }
    }
    
    Logger.log("✅ Migrasi selesai: " + migrationCount + " event ID berhasil dimigrasikan");
    
    // Simpan format baru
    PropertiesService.getScriptProperties().setProperty('eventIds', JSON.stringify(newEventIds));
}

/**
 * Fungsi untuk memperbaiki masalah sinkronisasi kalender untuk semua pengguna
 */
function fixAllUserCalendarSync() {
    var users = getUserData();
    var results = [];
    
    for (var number in users) {
        var user = users[number];
        results.push("👤 " + user.nama + ":");
        
        try {
            var result = verifyAllTaskEvents(number);
            if (result.success) {
                results.push("  " + result.message.replace(/\n/g, "\n  "));
            } else {
                results.push("  ❌ " + result.message);
            }
        } catch (e) {
            results.push("  ❌ Error: " + e.toString());
        }
        
        results.push("");
    }
    
    var message = results.join("\n");
    Logger.log(message);
    return message;
}

/**
 * Fungsi untuk mendiagnosis masalah sinkronisasi calendar
 */
function diagnoseCalendarIssues() {
    var users = getUserData();
    var results = [];
    
    for (var number in users) {
        var user = users[number];
        results.push("📋 " + user.nama + ":");
        
        try {
            var status = checkCalendarSyncStatus(number);
            results.push("  " + status.replace(/\n/g, "\n  "));
        } catch (e) {
            results.push("  ❌ Error: " + e.toString());
        }
        
        results.push("");
    }
    
    // Periksa event ID yang tersimpan
    try {
        var eventIds = PropertiesService.getScriptProperties().getProperty('eventIds');
        if (eventIds) {
            eventIds = JSON.parse(eventIds);
            var count = Object.keys(eventIds).length;
            results.push("🔑 Total Event ID tersimpan: " + count);
        } else {
            results.push("⚠️ Tidak ada Event ID tersimpan");
        }
    } catch (e) {
        results.push("❌ Error saat membaca Event ID: " + e.toString());
    }
    
    var message = results.join("\n");
    Logger.log(message);
    return message;
}

/**
 * Fungsi diagnosa khusus untuk masalah admin
 */
function diagnoseAdminIssues() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetSetup = ss.getSheetByName("SETUP");
    var userSheet = ss.getSheetByName("USERS");
    
    var results = [];
    
    try {
        // Periksa admin number di setup
        var adminNumber = sheetSetup.getRange("C3").getValue();
        results.push("Admin number from SETUP: " + adminNumber);
        
        if (!adminNumber) {
            results.push("❌ ERROR: Admin number tidak ditemukan di sheet SETUP");
        }
        
        // Periksa daftar user
        var users = getUserData();
        results.push("Jumlah user terdaftar: " + Object.keys(users).length);
        
        // Check if admin is in USERS sheet
        var adminFound = false;
        for (var number in users) {
            results.push("User: " + number + " = " + users[number].nama);
            if (number.toString().trim() === adminNumber.toString().trim()) {
                adminFound = true;
                results.push("✅ Admin ditemukan di daftar user");
            }
        }
        
        if (!adminFound) {
            results.push("❌ ERROR: Admin tidak ditemukan di sheet USERS");
            
            // Coba verifikasi admin
            results.push("Mencoba verifikasi admin...");
            try {
                verifyAdminUser();
                results.push("✅ Verifikasi admin berhasil dilakukan");
            } catch (e) {
                results.push("❌ Verifikasi admin gagal: " + e.toString());
            }
        }
        
        // Tes fungsi getUser
        var adminUser = getUser(adminNumber);
        if (adminUser) {
            results.push("✅ getUser() dapat menemukan admin");
            results.push("Data admin: " + JSON.stringify(adminUser));
        } else {
            results.push("❌ ERROR: getUser() tidak dapat menemukan admin");
        }
        
    } catch (e) {
        results.push("❌ Error: " + e.toString());
    }
    
    var message = results.join("\n");
    Logger.log(message);
    return message;
}

/**
 * Fungsi untuk memastikan template sheet tersedia
 * Mengembalikan error jika template tidak ditemukan
 */
function verifyTemplateSheets() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var templateTugas = ss.getSheetByName("TEMPLATE_TUGAS");
    var templateDone = ss.getSheetByName("TEMPLATE_DONE");
    
    if (!templateTugas) {
        throw new Error("Sheet TEMPLATE_TUGAS tidak ditemukan! Ini diperlukan sebagai template untuk sheet reminder pengguna baru.");
    }
    
    if (!templateDone) {
        throw new Error("Sheet TEMPLATE_DONE tidak ditemukan! Ini diperlukan sebagai template untuk sheet done pengguna baru.");
    }
    
    return "✅ Template sheets terverifikasi";
}

/**
 * Fungsi untuk membuat template sheets jika belum ada
 * Menggunakan REMINDER dan DONE sebagai dasar jika tersedia
 */
function createTemplateSheets() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var reminderSheet = ss.getSheetByName("REMINDER");
    var doneSheet = ss.getSheetByName("DONE");
    
    // Cek apakah template sudah ada
    var templateTugas = ss.getSheetByName("TEMPLATE_TUGAS");
    var templateDone = ss.getSheetByName("TEMPLATE_DONE");
    
    // Buat TEMPLATE_TUGAS jika belum ada
    if (!templateTugas) {
        if (reminderSheet) {
            // Copy dari REMINDER jika ada
            templateTugas = reminderSheet.copyTo(ss);
            templateTugas.setName("TEMPLATE_TUGAS");
            
            // Hapus data tugas (baris 10-40)
            templateTugas.getRange(10, 2, 31, 3).clearContent();
            
            Logger.log("✅ TEMPLATE_TUGAS dibuat dari sheet REMINDER");
        } else {
            // Buat template baru dari awal
            templateTugas = ss.insertSheet("TEMPLATE_TUGAS");
            
            // Set up header dan format dasar
            templateTugas.getRange("A1").setValue("DAFTAR TUGAS");
            templateTugas.getRange("A1:F1").merge();
            templateTugas.getRange("A1").setFontSize(14).setFontWeight("bold");
            
            // Header kolom
            templateTugas.getRange("B9:F9").setValues([["✓", "DEADLINE", "TUGAS", "CATATAN", "ACTION"]]);
            templateTugas.getRange("B9:F9").setFontWeight("bold");
            
            Logger.log("✅ TEMPLATE_TUGAS dibuat baru");
        }
    }
    
    // Buat TEMPLATE_DONE jika belum ada
    if (!templateDone) {
        if (doneSheet) {
            // Copy dari DONE jika ada
            templateDone = doneSheet.copyTo(ss);
            templateDone.setName("TEMPLATE_DONE");
            
            // Hapus data tugas (baris 10-40)
            templateDone.getRange(10, 2, 31, 3).clearContent();
            
            Logger.log("✅ TEMPLATE_DONE dibuat dari sheet DONE");
        } else {
            // Buat template baru dari awal
            templateDone = ss.insertSheet("TEMPLATE_DONE");
            
            // Set up header dan format dasar
            templateDone.getRange("A1").setValue("TUGAS SELESAI");
            templateDone.getRange("A1:E1").merge();
            templateDone.getRange("A1").setFontSize(14).setFontWeight("bold");
            
            // Header kolom
            templateDone.getRange("B9:D9").setValues([["✓", "DEADLINE", "TUGAS"]]);
            templateDone.getRange("B9:D9").setFontWeight("bold");
            
            Logger.log("✅ TEMPLATE_DONE dibuat baru");
        }
    }
    
    return "✅ Template sheets berhasil dibuat/diverifikasi";
}

/**
 * Fungsi yang dipanggil saat spreadsheet dibuka
 */
function onOpen() {
  createCustomMenu();
  
  // Verifikasi admin secara otomatis saat spreadsheet dibuka
  try {
    verifyAdminUser();
    Logger.log("✅ Admin user otomatis diverifikasi saat spreadsheet dibuka");
  } catch (e) {
    Logger.log("⚠️ Gagal memverifikasi admin user: " + e.toString());
  }
}
