function getTugasByHari(sheet, jumlahHari) {
    var data = sheet.getDataRange().getValues();
    var today = new Date();
    today.setHours(0, 0, 0, 0); // Reset jam untuk perbandingan
    var tugasByHari = {};
    var akanDatang = []; // Menyimpan tugas lebih dari "Besok"

    // Jika tidak ada tugas sama sekali
    var adaTugas = false;

    // ✅ Fungsi untuk memformat tanggal ke bahasa Indonesia
    function formatTanggalIndonesia(date) {
        var hari = hariIndo[date.getDay()];
        var tanggal = date.getDate();
        var bulan = bulanIndo[date.getMonth()];
        var tahun = date.getFullYear();

        return hari + ", " + tanggal + " " + bulan + " " + tahun;
    }

    // Fungsi untuk memformat jam dengan benar
    function formatJam(timeStr) {
        if (!timeStr) return "";
        
        // Jika timeStr adalah Date
        if (timeStr instanceof Date) {
            return Utilities.formatDate(timeStr, "Asia/Jakarta", "HH:mm");
        }
        
        // Jika timeStr adalah string format "HH:MM"
        if (typeof timeStr === "string" && timeStr.includes(":")) {
            return timeStr;
        }
        
        // Jika format lain, konversi dulu
        if (typeof timeStr === "string" || typeof timeStr === "number") {
            try {
                var time = timeStr.toString().trim();
                // Jika format HHMM, konversi ke HH:MM
                if (/^\d{4}$/.test(time)) {
                    var hours = time.substring(0, 2);
                    var minutes = time.substring(2, 4);
                    return hours + ":" + minutes;
                }
                return time;
            } catch (e) {
                return "";
            }
        }
        
        return "";
    }

    for (var i = 9; i < data.length; i++) { // Mulai dari baris ke-10
        var deadlineStr = data[i][2];
        if (!deadlineStr) continue; // Lewati jika tidak ada tanggal

        var deadline = new Date(deadlineStr);
        if (isNaN(deadline)) continue; // Lewati jika tidak valid
        deadline.setHours(0, 0, 0, 0);

        var waktu = data[i][5]; // Kolom F (indeks 5) berisi jam
        var selisihHari = Math.round((deadline - today) / (1000 * 60 * 60 * 24));
        if (selisihHari < 0) continue; // Lewati tugas yang sudah lewat
        
        // Jika ada minimal satu tugas valid
        adaTugas = true;

        var kategori = (selisihHari === 0) ? "HARI INI" :
            (selisihHari === 1) ? "BESOK" :
                (selisihHari > 1) ? "*AKAN DATANG*" : "";

        // Format tanggal dan waktu dengan format yang lebih simpel
        var tanggalStr = formatTanggalIndonesia(deadline);
        var timeStr = formatJam(waktu);
        
        // Gabungkan tanggal dan jam dalam format yang diinginkan
        var displayDate = tanggalStr;
        if (timeStr) {
            displayDate += ", " + timeStr;
        }

        if (kategori === "*AKAN DATANG*") {
            var tugasText = (data[i][1] === true)
                ? "- 📝~" + data[i][3] + "~ (" + displayDate + ")"
                : "- 📝" + data[i][3] + " (" + displayDate + ")";
            akanDatang.push(tugasText);
        } else {
            if (!tugasByHari[kategori]) tugasByHari[kategori] = [];
            if (data[i][3]) {
                var tugasText = (data[i][1] === true)
                    ? "~" + data[i][3] + "~ (" + displayDate + ")"
                    : "- 📝" + data[i][3] + " (" + displayDate + ")";
                tugasByHari[kategori].push(tugasText);
            }
        }
    }

    // Jika tidak ada tugas sama sekali, tampilkan pesan khusus
    if (!adaTugas) {
        return "Belum ada tugas yang ditambahkan.\n\nGunakan perintah *!add DDMMYYYY/Nama Tugas* untuk menambahkan tugas baru.";
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