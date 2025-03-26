function kirimReminderFonnte(e) {
    var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
    var sheetReminder = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("REMINDER");

    var namaUser = sheetSetup.getRange("C2").getValue();
    var noWhatsApp = sheetSetup.getRange("C3").getValue();
    var tokenFonnte = sheetSetup.getRange("C4").getValue();
    var jumlahHari = sheetSetup.getRange("C6").getValue();
    var hariIni = sheetSetup.getRange("C9").getValue();
    var jam1 = getJamFix(sheetSetup.getRange("C7").getValue());
    var jam2 = getJamFix(sheetSetup.getRange("C8").getValue());

    var now = new Date();
    var jamSekarang = Utilities.formatDate(now, "GMT+7", "HH:mm"); // Format jam sekarang
    var isManualRun = typeof e === "undefined" || e.manualTrigger; // Cek apakah dijalankan manual

    Logger.log("⏰ Sekarang jam: " + jamSekarang + " WIB");

    // **CEGAH PENGIRIMAN BERULANG SETIAP MENIT**
    // Hanya kirim jika jam & menit saat ini sama persis dengan jam di spreadsheet atau manual trigger
    if (!isManualRun && jamSekarang !== jam1 && jamSekarang !== jam2) {
        Logger.log("⏳ Tidak sesuai jadwal, script berhenti.");
        return;
    }

    var pesan = "";
    var jenisPesan = "";

    var pesanKirim = ""; // Variabel untuk menyimpan pesan yang akan dikirim

    if (jamSekarang === jam1 || isManualRun) { // Kirim otomatis dan manual
        jenisPesan = "Pesan Pertama";
        Logger.log("✅ Kirim Pesan Pertama (" + jam1 + " WIB)");

        var hour = now.getHours();
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

        pesanKirim = salam + " *" + namaUser + "* 👋 Berikut pengingat tugasmu!\n\n"
            + getTugasByHari(sheetReminder, 0) + "\n\n"
            + "Semangat yh! 🔥\n\n"
            + "```Pengingat 1/2 | " + hariIni + " | " + jamSekarang + "```";
    }

    if (jamSekarang === jam2 && !isManualRun) { // Hanya jalankan otomatis, tidak manual
        jenisPesan = "Pesan Kedua";
        Logger.log("✅ Kirim Pesan Kedua (" + jam2 + " WIB)");
        var hour = now.getHours();
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

        pesanKirim = salam + " *" + namaUser + "* 👋 Berikut pengingat tugasmu!\n\n"
            + getTugasByHari(sheetReminder, 0) + "\n\n"
            + "Semangat yh! 🔥\n\n"
            + "```Pengingat 2/2 | " + hariIni + " | " + jamSekarang + "```";
    }

    // ========== FONNTE ========== //
    if (pesanKirim !== "") {
        try {
            var url = "https://api.fonnte.com/send";
            var options = {
                "method": "post",
                "headers": { "Authorization": tokenFonnte },
                "payload": { "target": noWhatsApp, "message": pesanKirim }
            };

            var response = UrlFetchApp.fetch(url, options);
            Logger.log("📩 " + jenisPesan + " berhasil dikirim: " + response.getContentText());
        } catch (error) {
            Logger.log("❌ ERROR saat mengirim " + jenisPesan + ": " + error.message);
        }
    } else {
        Logger.log("⏳ Tidak ada pesan yang dikirim.");
    }
}

function getTugasByHari(sheet, jumlahHari) {
    var data = sheet.getDataRange().getValues();
    var today = new Date();
    today.setHours(0, 0, 0, 0); // Reset jam untuk perbandingan
    var tugasByHari = {};
    var akanDatang = []; // Menyimpan tugas lebih dari "Besok"

    // ✅ Fungsi untuk memformat tanggal ke bahasa Indonesia
    function formatTanggalIndonesia(date) {
        var hariIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        var bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

        var hari = hariIndo[date.getDay()];
        var tanggal = date.getDate();
        var bulan = bulanIndo[date.getMonth()];
        var tahun = date.getFullYear();

        return hari + ", " + tanggal + " " + bulan + " " + tahun;
    }

    for (var i = 9; i < data.length; i++) { // Mulai dari baris ke-10
        var deadlineStr = data[i][2];

        if (!deadlineStr) continue; // Lewati jika tidak ada tanggal

        var deadline = new Date(deadlineStr);
        if (isNaN(deadline)) continue; // Lewati jika tidak valid
        deadline.setHours(0, 0, 0, 0);

        var selisihHari = Math.round((deadline - today) / (1000 * 60 * 60 * 24));
        if (selisihHari < 0) continue; // Lewati tugas yang sudah lewat

        var kategori = (selisihHari === 0) ? "HARI INI" :
            (selisihHari === 1) ? "BESOK" :
                (selisihHari > 1) ? "*AKAN DATANG*" : "";

        if (kategori === "*AKAN DATANG*") {
            var tugasText = (data[i][1] === true)
                ? "- 📝~" + data[i][3] + "~ 🕒" + formatTanggalIndonesia(deadline)
                : "- 📝" + data[i][3] + " 🕒" + formatTanggalIndonesia(deadline);
            akanDatang.push(tugasText);
        } else {
            if (!tugasByHari[kategori]) tugasByHari[kategori] = [];
            if (data[i][3]) {
                var tugasText = (data[i][1] === true)
                    ? "~" + data[i][3] + "~"
                    : "- 📝" + data[i][3];
                tugasByHari[kategori].push(tugasText);
            }
        }
    }

    // Tambahkan keterangan "Belum ada tugas" jika suatu hari tidak ada tugas
    for (var j = 0; j <= jumlahHari; j++) {
        var tanggalCek = new Date();
        tanggalCek.setDate(today.getDate() + j);

        var kategoriCek = (j === 0) ? "HARI INI" :
            (j === 1) ? "BESOK" :
                Utilities.formatDate(tanggalCek, "GMT+7", "d MMM yyyy");

        if (!tugasByHari[kategoriCek]) {
            tugasByHari[kategoriCek] = ["_Tidak ada tugas_"];
        }
    }

    // Pastikan "Hari Ini" dan "Besok" selalu ada
    var kategoriList = ["HARI INI", "BESOK"];
    for (var j = 0; j < kategoriList.length; j++) {
        if (!tugasByHari[kategoriList[j]]) {
            tugasByHari[kategoriList[j]] = ["_Tidak ada tugas_"];
        }
    }

    var result = "";
    for (var hari in tugasByHari) {
        result += "*" + hari + "*\n" + tugasByHari[hari].join("\n") + "\n\n";
    }

    if (akanDatang.length > 0) {
        result += "*AKAN DATANG*\n" + akanDatang.join("\n") + "\n\n";
    }

    return result.trim();
}

function setTriggerKirimWA() {
    var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
    var jam1 = getJamFix(sheetSetup.getRange("C7").getValue());
    var jam2 = getJamFix(sheetSetup.getRange("C8").getValue());

    Logger.log("⏰ Jam sekarang: " + Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm") + " WIB");

    if (!jam1 && !jam2) {
        Logger.log("⚠️ Tidak ada jam yang disetting di SETUP!C7 dan SETUP!C8");
        return;
    }

    hapusTriggerLama();
    if (jam1) buatTriggerHarian("kirimReminderFonnte", jam1);
    if (jam2) buatTriggerHarian("kirimReminderFonnte", jam2);

    Logger.log("✅ Trigger harian berhasil diperbarui:");
    if (jam1) Logger.log("⏰ Pesan 1 akan dikirim setiap hari jam " + jam1 + " WIB");
    if (jam2) Logger.log("⏰ Pesan 2 akan dikirim setiap hari jam " + jam2 + " WIB");

    cekTriggerSet();
}

function buatTriggerHarian(namaFungsi, jam) {
    var jamSplit = jam.split(":");
    ScriptApp.newTrigger(namaFungsi)
        .timeBased()
        .everyDays(1)
        .atHour(parseInt(jamSplit[0], 10))
        .nearMinute(parseInt(jamSplit[1], 10))
        .create();
}

function hapusTriggerLama() {
    ScriptApp.getProjectTriggers().forEach(t => {
        if (t.getHandlerFunction() === "kirimReminderFonnte") ScriptApp.deleteTrigger(t);
    });
}

function cekTriggerSet() {
    Logger.log(ScriptApp.getProjectTriggers().length > 0 ? "✅ Trigger aktif" : "⚠️ Tidak ada trigger tersimpan.");
}