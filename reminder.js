function kirimReminderFonnte(e) {
    var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
    var tokenFonnte = sheetSetup.getRange("C4").getValue();
    var jam1 = getJamFix(sheetSetup.getRange("C7").getValue());
    var jam2 = getJamFix(sheetSetup.getRange("C8").getValue());

    var now = new Date();
    var jamSekarang = Utilities.formatDate(now, "GMT+7", "HH:mm"); // Format jam sekarang
    var isManualRun = typeof e === "undefined" || e.manualTrigger; // Cek apakah dijalankan manual
    var whatsappNumber = e && e.whatsappNumber ? e.whatsappNumber : null;

    Logger.log("⏰ Sekarang jam: " + jamSekarang + " WIB");

    // **CEGAH PENGIRIMAN BERULANG SETIAP MENIT**
    // Hanya kirim jika jam & menit saat ini sama persis dengan jam di spreadsheet atau manual trigger
    if (!isManualRun && !whatsappNumber && jamSekarang !== jam1 && jamSekarang !== jam2) {
        Logger.log("⏳ Tidak sesuai jadwal, script berhenti.");
        return;
    }

    // Jika pemanggilan manual dengan nomor khusus
    if (whatsappNumber) {
        sendReminderToUser(whatsappNumber, jamSekarang, tokenFonnte);
        return;
    }
    
    // Jika pemanggilan otomatis (schedule), kirim ke semua pengguna
    if (!whatsappNumber) {
        var users = getUserData();
        for (var number in users) {
            sendReminderToUser(number, jamSekarang, tokenFonnte);
        }
    }
}

function sendReminderToUser(whatsappNumber, jamSekarang, tokenFonnte) {
    var user = getUser(whatsappNumber);
    if (!user) {
        Logger.log("⚠️ User tidak ditemukan: " + whatsappNumber);
        return;
    }
    
    var hariIni = new Date();
    var hari = hariIndo[hariIni.getDay()];
    var tanggal = hariIni.getDate();
    var bulan = bulanIndo[hariIni.getMonth()];
    var tahun = hariIni.getFullYear();
    var hariIniFormatted = hari + ", " + tanggal + " " + bulan + " " + tahun;
    
    var namaUser = user.nama;
    var sheetReminder = getSheetForUser(whatsappNumber, "reminder");
    
    if (!sheetReminder) {
        Logger.log("❌ Tidak dapat menemukan sheet reminder untuk: " + whatsappNumber);
        sendFeedback(whatsappNumber, "❌ Terjadi kesalahan sistem. Silakan hubungi admin.");
        return;
    }
    
    var hour = new Date().getHours();
    var salam = "Halo";
    if (hour >= 5 && hour < 12) {
        salam = "Pagi";
    } else if (hour >= 12 && hour < 15) {
        salam = "Siang";
    } else if (hour >= 15 && hour < 18) {
        salam = "Sore";
    } else {
        salam = "Malam";
    }

    var pesanKirim = salam + " *" + namaUser + "* 👋 Berikut pengingat tugasmu!\n\n"
        + getTugasByHari(sheetReminder, 0) + "\n\n"
        + "Semangat yh! 🔥\n\n"
        + "```Reminder V2.5 | " + hariIniFormatted + " | " + jamSekarang + "```";

    try {
        var url = "https://api.fonnte.com/send";
        var options = {
            "method": "post",
            "headers": { "Authorization": tokenFonnte },
            "payload": { "target": whatsappNumber, "message": pesanKirim }
        };

        var response = UrlFetchApp.fetch(url, options);
        Logger.log("📩 Pesan berhasil dikirim ke " + namaUser + ": " + response.getContentText());
    } catch (error) {
        Logger.log("❌ ERROR saat mengirim pesan ke " + namaUser + ": " + error.message);
    }
}
