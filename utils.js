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
        calendarId = sheetSetup.getRange("C10").getValue();
        
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
