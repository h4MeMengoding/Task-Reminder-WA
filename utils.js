const hariIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function getJamFix(jamCellValue) {
    if (jamCellValue instanceof Date) {
        return Utilities.formatDate(jamCellValue, Session.getScriptTimeZone(), "HH:mm");
    } else if (typeof jamCellValue === "number") {
        var jam = Math.floor(jamCellValue * 24);
        var menit = Math.round((jamCellValue * 1440) % 60);
        return ("0" + jam).slice(-2) + ":" + ("0" + menit).slice(-2);
    } else if (typeof jamCellValue === "string") {
        return jamCellValue.trim();
    }
    return "00:00";
}

function sendFeedback(to, message) {
    var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
    var tokenFonnte = sheetSetup.getRange("C4").getValue();
    var url = "https://api.fonnte.com/send";
    var options = {
        "method": "post",
        "headers": { "Authorization": tokenFonnte },
        "payload": { "target": to, "message": message }
    };

    try {
        var response = UrlFetchApp.fetch(url, options);
        Logger.log("📩 Feedback berhasil dikirim: " + response.getContentText());
    } catch (error) {
        Logger.log("❌ ERROR saat mengirim feedback: " + error.message);
    }
}

function perbaruiTanggal() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var cell = sheet.getRange("C9"); // Ubah sesuai lokasi sel yang diinginkan
    var today = new Date();
    var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    var formattedDate = today.toLocaleDateString('id-ID', options);
    cell.setValue(formattedDate);
}

function checkFonnteQuota(token) {
    if (!token) {
        return {
            success: false,
            message: 'Token Fonnte tidak ditemukan'
        };
    }

    var url = "https://api.fonnte.com/get-devices";
    var options = {
        "method": "POST",
        "headers": {
            "Authorization": token
        }
    };

    try {
        var response = UrlFetchApp.fetch(url, options);
        var data = JSON.parse(response.getContentText());
        Logger.log("Response from Fonnte: " + JSON.stringify(data));

        if (data && data.status === true && data.data && data.data.length > 0) {
            return {
                success: true,
                deviceInfo: {
                    quota: data.data[0].quota,
                    status: data.data[0].status,
                    messages: data.messages
                }
            };
        }

        return {
            success: false,
            message: 'Gagal mendapatkan informasi API'
        };
    } catch (error) {
        Logger.log("Error checking Fonnte: " + error.toString());
        return {
            success: false,
            message: 'Error saat mengecek API: ' + error.message
        };
    }
}

function getCalendarId() {
    // Coba ambil dari cache dulu
    var calendarId = CacheService.getScriptCache().get('calendarId');
    
    // Jika tidak ada di cache, ambil dari sheet
    if (!calendarId) {
        var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
        calendarId = sheetSetup.getRange("C11").getValue();
        
        // Simpan ke cache selama 6 jam
        if (calendarId) {
            CacheService.getScriptCache().put('calendarId', calendarId, 21600);
            // Simpan juga ke Properties sebagai backup
            PropertiesService.getScriptProperties().setProperty('calendarId', calendarId);
        }
    }
    
    return calendarId;
}

function clearCalendarIdCache() {
    CacheService.getScriptCache().remove('calendarId');
}

function getUserData() {
    var userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("USERS");
    if (!userSheet) {
        // Jika sheet USERS belum ada, buat sheet baru
        createUserSheet();
        userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("USERS");
    }
    
    var data = userSheet.getDataRange().getValues();
    var users = {};
    
    // Mulai dari baris 2 (setelah header)
    for (var i = 1; i < data.length; i++) {
        if (data[i][0]) { // Jika ada nomor WA
            users[data[i][0]] = {
                nama: data[i][1] || "User",
                calendarId: data[i][2] || "",
                reminderSheet: data[i][3] || "",
                doneSheet: data[i][4] || ""
            };
        }
    }
    
    return users;
}

/**
 * Fungsi untuk mendapatkan data pengguna, dengan tambahan debug untuk membantu troubleshooting
 */
function getUser(whatsappNumber) {
    // Pastikan input valid
    if (!whatsappNumber) {
        Logger.log("❌ getUser dipanggil tanpa nomor WhatsApp");
        return null;
    }
    
    // Standarisasi format nomor
    var normalizedNumber = whatsappNumber.toString().trim();
    
    Logger.log("⚙️ getUser dipanggil untuk: " + normalizedNumber);
    
    // Coba ambil dari data users terlebih dahulu
    var users = getUserData();
    
    // Debug output untuk melihat user yang tersedia
    Logger.log("👥 Daftar users tersedia: " + Object.keys(users).join(", "));
    
    // Cek apakah user ada di daftar
    for (var registeredNumber in users) {
        if (normalizedNumber === registeredNumber.toString().trim()) {
            Logger.log("✅ User ditemukan dalam daftar users: " + normalizedNumber);
            return users[registeredNumber];
        }
    }
    
    // Jika user tidak ditemukan, cek apakah ini admin
    var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
    var adminNumber = sheetSetup.getRange("C3").getValue().toString().trim();
    
    Logger.log("👤 Admin dari SETUP: '" + adminNumber + "'");
    Logger.log("🔄 Membandingkan dengan: '" + normalizedNumber + "'");
    
    // Pengecekan admin yang lebih ketat
    if (normalizedNumber === adminNumber) {
        Logger.log("✅ Admin terdeteksi, menggunakan data fallback");
        
        return {
            nama: sheetSetup.getRange("C2").getValue() || "Admin",
            calendarId: sheetSetup.getRange("C11").getValue() || "",
            reminderSheet: "REMINDER",
            doneSheet: "DONE"
        };
    }
    
    Logger.log("❌ User tidak ditemukan dan bukan admin");
    return null;
}

function createUserSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = ss.insertSheet("USERS");
    
    // Set up header
    userSheet.getRange("A1:E1").setValues([["Nomor WA", "Nama", "Calendar ID", "Reminder Sheet", "Done Sheet"]]);
    userSheet.getRange("A1:E1").setFontWeight("bold");
    
    // Tambahkan pengguna pertama dari sheet SETUP
    var setupSheet = ss.getSheetByName("SETUP");
    var noWA = setupSheet.getRange("C3").getValue();
    var nama = setupSheet.getRange("C2").getValue();
    var calendarId = setupSheet.getRange("C11").getValue();
    
    userSheet.getRange("A2:E2").setValues([[noWA, nama, calendarId, "REMINDER", "DONE"]]);
}

function getSheetForUser(whatsappNumber, type) {
    var user = getUser(whatsappNumber);
    if (!user) return null;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = "";
    
    if (type === "reminder") {
        sheetName = user.reminderSheet;
    } else if (type === "done") {
        sheetName = user.doneSheet;
    }
    
    // Cek apakah sheet sudah ada
    var sheet = ss.getSheetByName(sheetName);
    
    // Jika belum ada, buat sheet baru
    if (!sheet) {
        if (type === "reminder") {
            // Clone template TEMPLATE_TUGAS
            sheet = cloneSheet("TEMPLATE_TUGAS", sheetName);
            if (!sheet) {
                // Jika gagal, kembalikan error
                Logger.log("❌ Template TEMPLATE_TUGAS tidak ditemukan. Tidak dapat membuat sheet untuk user.");
                return null;
            }
        } else if (type === "done") {
            // Clone template TEMPLATE_DONE
            sheet = cloneSheet("TEMPLATE_DONE", sheetName);
            if (!sheet) {
                // Jika gagal, kembalikan error
                Logger.log("❌ Template TEMPLATE_DONE tidak ditemukan. Tidak dapat membuat sheet untuk user.");
                return null;
            }
        }
    }
    
    return sheet;
}

function cloneSheet(templateName, newName) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var template = ss.getSheetByName(templateName);
    
    if (!template) {
        Logger.log("❌ Sheet template " + templateName + " tidak ditemukan");
        return null;
    }
    
    var newSheet = template.copyTo(ss);
    newSheet.setName(newName);
    return newSheet;
}

function addNewUser(whatsappNumber, name, calendarId) {
    var userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("USERS");
    
    if (!userSheet) {
        createUserSheet();
        userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("USERS");
    }
    
    // Cek apakah user sudah ada
    var data = userSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
        if (data[i][0] === whatsappNumber) {
            // Update data user yang sudah ada
            userSheet.getRange(i+1, 2, 1, 2).setValues([[name, calendarId]]);
            return {
                success: true, 
                message: "User sudah ada dan berhasil diupdate"
            };
        }
    }
    
    // Buat nama sheet baru untuk user
    var reminderSheetName = "REMINDER_" + name.replace(/[^a-zA-Z0-9]/g, "");
    var doneSheetName = "DONE_" + name.replace(/[^a-zA-Z0-9]/g, "");
    
    // Tambahkan user baru
    var lastRow = userSheet.getLastRow() + 1;
    userSheet.getRange(lastRow, 1, 1, 5).setValues([[whatsappNumber, name, calendarId, reminderSheetName, doneSheetName]]);
    
    return {
        success: true, 
        message: "User baru berhasil ditambahkan", 
        reminderSheet: reminderSheetName, 
        doneSheet: doneSheetName
    };
}
