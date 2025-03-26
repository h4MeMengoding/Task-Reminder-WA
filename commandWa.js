function handleCalendarCommand(sender, tokenFonnte) {
    var calendarId = getCalendarId();

    if (calendarId) {
        try {
            var calendar = CalendarApp.getCalendarById(calendarId);
            if (calendar) {
                var calendarUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}`;
                var responseMessage = "*📅 Google Calendar*\n\n"
                    + "Berikut link untuk melihat jadwal tugas:\n"
                    + calendarUrl + "\n\n"
                    + "Cara Subscribe:\n"
                    + "1. Buka link di atas\n"
                    + "2. Klik tombol '+ Google Calendar' di pojok kanan bawah\n"
                    + "3. Calendar akan otomatis tersinkron ke Google Calendar kamu";

                sendFeedback(sender, responseMessage);
                return true;
            }
        } catch (error) {
            Logger.log("Error getting calendar URL: " + error.toString());
            sendFeedback(sender, "❌ Terjadi kesalahan saat mengakses calendar.");
        }
    } else {
        sendFeedback(sender, "❌ Calendar ID belum diatur. Silakan hubungi admin.");
    }
    return true;
}

function handleHelpCommand(sender, tokenFonnte) {
    var helpMessage = "*📋 DAFTAR PERINTAH*\n\n"
        + "1️⃣ *!todo*\n"
        + "    • Mengecek daftar tugas\n\n"
        + "2️⃣ *!done*\n"
        + "    • Melihat daftar tugas selesai\n\n"
        + "3️⃣ *!add*\n"
        + "    • Menambahkan tugas baru\n"
        + "    • Format: !add DDMMYYYY/Nama Tugas\n"
        + "    • Contoh: !add 25032024/Fisika - Soal 1-100\n\n"
        + "4️⃣ *!del*\n"
        + "    • Menghapus tugas\n"
        + "    • Format: !del Nama Tugas\n"
        + "    • Contoh: !del Tugas Matematika\n\n"
        + "5️⃣ *!selesai*\n"
        + "    • Menandai tugas selesai\n"
        + "    • Format: !selesai Nama Tugas\n"
        + "    • Contoh: !selesai Tugas Matematika\n\n"
        + "6️⃣ *!calendar*\n"
        + "    • Mendapatkan link Google Calendar\n\n"
        + "7️⃣ *!api*\n"
        + "    • Cek sisa kuota pesan WhatsApp\n"
        + "    • Menampilkan total, terpakai, dan sisa kuota";

    sendFeedback(sender, helpMessage);
    return true;
}

function handleApiCommand(sender, tokenFonnte) {
    var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
    var token = sheetSetup.getRange("C12").getValue(); // Ambil token dari C12

    if (!token) {
        sendFeedback(sender, "❌ Token Fonnte tidak ditemukan di setup");
        return false;
    }

    var quotaInfo = checkFonnteQuota(token);

    if (quotaInfo.success) {
        var message = "*📊 INFO API FONNTE*\n\n"
            + "✉️ Sisa Kuota: " + quotaInfo.deviceInfo.quota + " pesan\n"
            + "📨 Terpakai: " + quotaInfo.deviceInfo.messages + " pesan\n"
            + "🔌 Status: " + (quotaInfo.deviceInfo.status === "connect" ? "Terhubung ✅" : "Terputus ❌");

        sendFeedback(sender, message);
        return true;
    } else {
        sendFeedback(sender, "❌ " + quotaInfo.message);
        return false;
    }
}

function handleDoneCommand(sender, tokenFonnte) {
    var result = getCompletedTasks();
    sendFeedback(sender, result);
    return true;
}

function handleTodoCommand(sender, tokenFonnte) {
    kirimReminderFonnte({ manualTrigger: true });
    return true;
}

function handleAddCommand(sender, message) {
    var errorMsg = "Format salah. Gunakan format: !add DDMMYYYY/Nama Tugas\nContoh: !add 31122025/Tugas Akhir";

    if (message === "!add") {
        sendFeedback(sender, errorMsg);
        return true;
    }

    var taskDetails = message.substring(5).split("/");

    if (taskDetails.length === 2) {
        var deadline = taskDetails[0].trim();
        var taskName = taskDetails[1].trim();

        if (!/^\d{8}$/.test(deadline)) {
            sendFeedback(sender, errorMsg);
            return true;
        }

        var result = addTaskToReminder(deadline, taskName, sender);
        sendFeedback(sender, result.message);
        return true;
    } else {
        sendFeedback(sender, errorMsg);
        return true;
    }
}

function handleDelCommand(sender, message) {
    if (message === "!del") {
        var errorMsg = "Format salah. Gunakan format: !del Nama Tugas\nContoh: !del Tugas Matematika";
        sendFeedback(sender, errorMsg);
        return true;
    }

    var taskName = message.substring(5).trim();
    var result = deleteTaskByName(taskName);
    sendFeedback(sender, result.message);
    return true;
}

function handleSelesaiCommand(sender, message) {
    if (message === "!selesai") {
        var errorMsg = "Format salah. Gunakan format: !selesai Nama Tugas\nContoh: !selesai Tugas Matematika";
        sendFeedback(sender, errorMsg);
        return true;
    }

    var taskName = message.substring(8).trim();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetReminder = ss.getSheetByName("REMINDER");
    var startRow = 10;
    var endRow = 40;
    var values = sheetReminder.getRange(startRow, 2, endRow - startRow + 1, 3).getValues();

    for (var i = 0; i < values.length; i++) {
        if (values[i][2] && values[i][2].toString().toLowerCase() === taskName.toLowerCase()) {
            try {
                // Centang checkbox tugas
                sheetReminder.getRange(startRow + i, 2).setValue(true);
                // Trigger moveCompletedTasks
                moveCompletedTasks();
                return true;
            } catch (e) {
                Logger.log("❌ Gagal menandai tugas selesai: " + e.toString());
                sendFeedback(sender, "❌ Terjadi kesalahan saat menandai tugas selesai");
                return false;
            }
        }
    }

    sendFeedback(sender, "❌ Tugas *" + taskName + "* tidak ditemukan");
    return false;
}

function deleteTaskByName(taskName) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetReminder = ss.getSheetByName("REMINDER");
    var startRow = 10;
    var endRow = 40;
    var values = sheetReminder.getRange(startRow, 2, endRow - startRow + 1, 3).getValues();

    for (var i = 0; i < values.length; i++) {
        if (values[i][2] && values[i][2].toString().toLowerCase() === taskName.toLowerCase()) {
            var row = startRow + i;
            var taskId = "TASK_" + row;
            var eventId = getEventId(taskId);

            try {
                // Hapus event dari calendar jika ada
                if (eventId) {
                    deleteCalendarEvent(eventId);
                    deleteEventIdData(taskId);
                }

                // Hapus data tugas dari sheet
                sheetReminder.getRange(row, 2, 1, 3).clearContent();

                // Sort ulang tugas
                sortTasksByDeadline();

                Logger.log("✅ Tugas berhasil dihapus: " + taskName);
                return {
                    success: true,
                    message: "✅ Tugas *" + taskName + "* berhasil dihapus"
                };
            } catch (e) {
                Logger.log("❌ Gagal menghapus tugas: " + e.toString());
                return {
                    success: false,
                    message: "❌ Terjadi kesalahan saat menghapus tugas"
                };
            }
        }
    }

    return {
        success: false,
        message: "❌ Tugas *" + taskName + "* tidak ditemukan"
    };
}

function getCompletedTasks() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetDone = ss.getSheetByName("DONE");
    var values = sheetDone.getRange(10, 2, 31, 3).getValues();
    var completedTasks = [];

    function formatTanggalIndonesia(date) {
        var bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        var tanggal = date.getDate();
        var bulan = bulanIndo[date.getMonth()];
        var tahun = date.getFullYear();
        return tanggal + " " + bulan + " " + tahun;
    }

    for (var i = 0; i < values.length; i++) {
        if (values[i][1]) {
            var deadline = new Date(values[i][1]);
            var taskName = values[i][2];
            var formattedDate = formatTanggalIndonesia(deadline);
            completedTasks.push("✅ " + taskName + "\n   📅 " + formattedDate);
        }
    }

    if (completedTasks.length === 0) {
        return "Belum ada tugas yang selesai";
    }

    return "*📋 DAFTAR TUGAS SELESAI*\n\n" + completedTasks.join("\n\n");
}

function addTaskToReminder(deadline, taskName, sender) {
    var sheetReminder = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("REMINDER");
    var calendarId = getCalendarId();
    var startRow = 10;
    var endRow = 40;
    var checkCol = 2;
    var deadlineCol = 3;
    var taskCol = 4;

    var values = sheetReminder.getRange(startRow, checkCol, endRow - startRow + 1, 3).getValues();

    for (var i = 0; i < values.length; i++) {
        if (!values[i][1] && !values[i][2]) {
            try {
                var day = parseInt(deadline.substring(0, 2), 10);
                var month = parseInt(deadline.substring(2, 4), 10) - 1;
                var year = parseInt(deadline.substring(4, 8), 10);
                var date = new Date(year, month, day);

                if (isNaN(date.getTime())) {
                    Logger.log("Invalid date format: " + deadline);
                    return {
                        success: false,
                        message: 'Format tanggal salah. Gunakan format: DDMMYYYY'
                    };
                }

                // Update spreadsheet in batch
                var row = startRow + i;
                var taskId = "TASK_" + row;
                sheetReminder.getRange(row, deadlineCol, 1, 2).setValues([[date, taskName]]);

                // Pastikan update spreadsheet selesai
                SpreadsheetApp.flush();
                Utilities.sleep(100);

                // Handle calendar event
                if (calendarId) {
                    var calendar = CalendarApp.getCalendarById(calendarId);
                    if (calendar) {
                        var existingEventId = getEventId(taskId);

                        if (!existingEventId) {
                            var event = calendar.createAllDayEvent(
                                "📝 " + taskName,
                                new Date(date),
                                {
                                    description: "Tugas dari Reminder WA",
                                    color: CalendarApp.EventColor.PALE_RED
                                }
                            );

                            saveEventId(taskId, event.getId());
                            Utilities.sleep(200);
                        }
                    }
                }

                var hariIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
                var bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
                    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

                var hari = hariIndo[date.getDay()];
                var tanggal = date.getDate();
                var bulan = bulanIndo[date.getMonth()];
                var tahun = date.getFullYear();

                var tanggalFormatted = hari + ", " + tanggal + " " + bulan + " " + tahun;
                var responseMessage = "Berhasil menambahkan tugas " + "*" + taskName + "*" + " dengan deadline " + "*" + tanggalFormatted + "*";

                Logger.log("Task added successfully: " + responseMessage);

                sortTasksByDeadline();

                return {
                    success: true,
                    message: responseMessage
                };
            } catch (error) {
                Logger.log("Error adding task: " + error.toString());
                return {
                    success: false,
                    message: 'Terjadi kesalahan saat menambahkan tugas'
                };
            }
        }
    }

    Logger.log("No empty row found");
    return {
        success: false,
        message: 'Tidak ada baris kosong untuk menambahkan tugas'
    };
}
