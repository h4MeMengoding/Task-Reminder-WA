function handleCalendarCommand(sender, tokenFonnte) {
    var user = getUser(sender);
    
    if (!user || !user.calendarId) {
        sendFeedback(sender, "❌ Calendar ID belum diatur. Silakan hubungi admin.");
        return true;
    }
    
    var calendarId = user.calendarId;

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
    
    return true;
}

function handleFixCalendarCommand(sender, tokenFonnte) {
    var user = getUser(sender);
    
    if (!user) {
        sendFeedback(sender, "❌ User tidak terdaftar. Hubungi admin untuk mendaftar.");
        return true;
    }
    
    if (!user.calendarId) {
        sendFeedback(sender, "❌ Calendar ID belum diatur. Silakan hubungi admin.");
        return true;
    }
    
    try {
        var result = verifyAllTaskEvents(sender);
        
        if (result.success) {
            sendFeedback(sender, "🛠️ *Perbaikan Calendar Selesai*\n\n" + result.message);
        } else {
            sendFeedback(sender, "❌ *Gagal Memperbaiki Calendar*\n\n" + result.message);
        }
        
        return true;
    } catch (e) {
        sendFeedback(sender, "❌ Terjadi kesalahan: " + e.message);
        Logger.log("Error handling fix calendar: " + e.toString());
        return false;
    }
}

function handleHelpCommand(sender, tokenFonnte) {
    var helpMessage = "*📋 DAFTAR PERINTAH*\n\n"
        + "1️⃣ *!todo*\n"
        + "    • Mengecek daftar tugas\n\n"
        + "2️⃣ *!done*\n"
        + "    • Melihat daftar tugas selesai\n\n"
        + "3️⃣ *!add*\n"
        + "    • Menambahkan tugas baru\n"
        + "    • Format tanpa jam: !add DDMM/Nama Tugas atau !add DDMMYYYY/Nama Tugas\n"
        + "    • Format dengan jam: !add DDMM/HHMM/Nama Tugas atau !add DDMMYYYY/HHMM/Nama Tugas\n"
        + "    • Contoh: !add 2503/Fisika - Soal 1-100 (tanpa jam)\n"
        + "    • Contoh: !add 2503/1930/Fisika - Soal 1-100 (dengan jam 19:30)\n\n"
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
        + "7️⃣ *!sync*\n"
        + "    • Perbaiki sinkronisasi calendar\n\n"
        + "8️⃣ *!api*\n"
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
    var result = getCompletedTasks(sender);
    sendFeedback(sender, result);
    return true;
}

function handleTodoCommand(sender, tokenFonnte) {
    kirimReminderFonnte({ manualTrigger: true, whatsappNumber: sender });
    return true;
}

function handleAddCommand(sender, message) {
    var errorMsg = "Format salah. Gunakan format:\n!add DDMM/Nama Tugas\n!add DDMMYYYY/Nama Tugas\n!add DDMM/HHMM/Nama Tugas\n!add DDMMYYYY/HHMM/Nama Tugas";

    if (message === "!add") {
        sendFeedback(sender, errorMsg);
        return true;
    }

    var taskDetails = message.substring(5).split("/");

    // Format 1: !add DDMM/Nama
    // Format 2: !add DDMMYYYY/Nama
    // Format 3: !add DDMM/HHMM/Nama
    // Format 4: !add DDMMYYYY/HHMM/Nama
    if (taskDetails.length === 2 || taskDetails.length === 3) {
        var deadline = taskDetails[0].trim();
        var taskName, timeStr;
        
        if (taskDetails.length === 2) {
            // Format lama: !add DDMM/Nama atau !add DDMMYYYY/Nama
            taskName = taskDetails[1].trim();
            timeStr = null;
        } else {
            // Format baru: !add DDMM/HHMM/Nama atau !add DDMMYYYY/HHMM/Nama
            timeStr = taskDetails[1].trim();
            taskName = taskDetails[2].trim();
        }

        if (!(/^\d{4}$/.test(deadline) || /^\d{8}$/.test(deadline))) {
            sendFeedback(sender, errorMsg);
            return true;
        }
        
        if (timeStr && !/^\d{4}$/.test(timeStr)) {
            sendFeedback(sender, "Format jam salah. Gunakan format HHMM (contoh: 1930 untuk jam 19:30)");
            return true;
        }

        // Cek apakah user memiliki sheet reminder
        var sheetReminder = getSheetForUser(sender, "reminder");
        if (!sheetReminder) {
            sendFeedback(sender, "❌ Terjadi kesalahan: Sheet reminder tidak dapat dibuat. Silakan hubungi admin.");
            return true;
        }

        var result = addTaskToReminder(deadline, timeStr, taskName, sender);
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
    var result = deleteTaskByName(taskName, sender);
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
    var sheetReminder = getSheetForUser(sender, "reminder");
    
    if (!sheetReminder) {
        sendFeedback(sender, "❌ Terjadi kesalahan: Sheet reminder tidak dapat ditemukan. Silakan hubungi admin.");
        return false;
    }
    
    var startRow = 10;
    var endRow = 40;
    var values = sheetReminder.getRange(startRow, 2, endRow - startRow + 1, 3).getValues();

    for (var i = 0; i < values.length; i++) {
        if (values[i][2] && values[i][2].toString().toLowerCase() === taskName.toLowerCase()) {
            try {
                // Centang checkbox tugas
                sheetReminder.getRange(startRow + i, 2).setValue(true);
                // Trigger moveCompletedTasks dengan flag true untuk menandai bahwa ini dari perintah !selesai
                moveCompletedTasks(sender, true);
                
                // Kita tidak perlu mengirim feedback di sini karena sudah ditangani di moveCompletedTasks
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

function handleUserCommand(sender, message) {
    var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
    var adminNumber = sheetSetup.getRange("C3").getValue();
    
    // Hanya admin yang bisa menambahkan user
    if (sender !== adminNumber) {
        sendFeedback(sender, "❌ Maaf, hanya admin yang dapat menggunakan perintah ini.");
        return true;
    }
    
    if (message === "!user") {
        var errorMsg = "Format salah. Gunakan format: !user tambah/NomorWA/Nama/CalendarID\n" +
                      "Contoh: !user tambah/628123456789/John Doe/john.doe@gmail.com";
        sendFeedback(sender, errorMsg);
        return true;
    }
    
    var commandParts = message.substring(6).split("/");
    
    if (commandParts[0].toLowerCase() === "tambah" && commandParts.length >= 3) {
        var whatsappNumber = commandParts[1].trim();
        var name = commandParts[2].trim();
        var calendarId = commandParts.length > 3 ? commandParts[3].trim() : "";
        
        // Validasi nomor WhatsApp
        if (!/^[0-9]{10,15}$/.test(whatsappNumber.replace(/\+/g, ''))) {
            sendFeedback(sender, "❌ Format nomor WhatsApp tidak valid.");
            return true;
        }
        
        var result = addNewUser(whatsappNumber, name, calendarId);
        
        if (result.success) {
            // Cek template sheets
            var ss = SpreadsheetApp.getActiveSpreadsheet();
            var templateTugas = ss.getSheetByName("TEMPLATE_TUGAS");
            var templateDone = ss.getSheetByName("TEMPLATE_DONE");
            
            if (!templateTugas || !templateDone) {
                sendFeedback(sender, "⚠️ Peringatan: Template sheets (TEMPLATE_TUGAS atau TEMPLATE_DONE) tidak ditemukan. " +
                           "User telah ditambahkan, tetapi tidak dapat membuat sheet reminder dan done.");
                return true;
            }
            
            // Buat sheet baru untuk user
            var reminderSheet = getSheetForUser(whatsappNumber, "reminder");
            var doneSheet = getSheetForUser(whatsappNumber, "done");
            
            if (!reminderSheet || !doneSheet) {
                sendFeedback(sender, "⚠️ Peringatan: Gagal membuat sheet untuk user baru. " +
                           "User telah ditambahkan, tetapi sheet tidak dapat dibuat.");
                return true;
            }
            
            var responseMessage = "✅ User baru berhasil ditambahkan!\n\n" +
                                 "Nama: *" + name + "*\n" +
                                 "Nomor WA: *" + whatsappNumber + "*\n" +
                                 "Sheet Reminder: *" + result.reminderSheet + "*\n" +
                                 "Sheet Done: *" + result.doneSheet + "*\n";
            
            if (calendarId) {
                responseMessage += "Calendar ID: *" + calendarId + "*";
            } else {
                responseMessage += "\n⚠️ Calendar ID belum diisi. Gunakan perintah:\n" +
                                  "!user calendar/" + whatsappNumber + "/calendar_id@gmail.com";
            }
            
            sendFeedback(sender, responseMessage);
            
            // Kirim pesan selamat datang ke user baru
            var welcomeMessage = "Halo *" + name + "* 👋\n\n" +
                               "Selamat datang di Sistem Pengingat Tugas!\n\n" +
                               "Gunakan perintah *!help* untuk melihat daftar perintah yang tersedia.";
            
            sendFeedback(whatsappNumber, welcomeMessage);
        } else {
            sendFeedback(sender, "❌ Gagal menambahkan user: " + result.message);
        }
        
        return true;
    } else if (commandParts[0].toLowerCase() === "list") {
        // Tampilkan daftar user
        var users = getUserData();
        var userList = "*📋 DAFTAR PENGGUNA*\n\n";
        
        var index = 1;
        for (var number in users) {
            userList += index + ". *" + users[number].nama + "*\n" +
                      "   📱 " + number + "\n" +
                      "   📅 " + (users[number].calendarId || "Belum diatur") + "\n\n";
            index++;
        }
        
        sendFeedback(sender, userList);
        return true;
    } else if (commandParts[0].toLowerCase() === "calendar" && commandParts.length === 3) {
        // Update calendar ID user
        var whatsappNumber = commandParts[1].trim();
        var calendarId = commandParts[2].trim();
        
        var user = getUser(whatsappNumber);
        if (!user) {
            sendFeedback(sender, "❌ User dengan nomor " + whatsappNumber + " tidak ditemukan.");
            return true;
        }
        
        try {
            // Validasi calendar ID
            var calendar = CalendarApp.getCalendarById(calendarId);
            if (!calendar) {
                sendFeedback(sender, "❌ Calendar ID tidak valid atau tidak dapat diakses.");
                return true;
            }
            
            // Update calendar ID di sheet USERS
            var userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("USERS");
            var data = userSheet.getDataRange().getValues();
            
            for (var i = 1; i < data.length; i++) {
                if (data[i][0] === whatsappNumber) {
                    userSheet.getRange(i+1, 3).setValue(calendarId);
                    break;
                }
            }
            
            sendFeedback(sender, "✅ Calendar ID untuk *" + user.nama + "* berhasil diperbarui: *" + calendarId + "*");
        } catch (error) {
            Logger.log("Error updating calendar ID: " + error.toString());
            sendFeedback(sender, "❌ Terjadi kesalahan saat memperbarui Calendar ID: " + error.message);
        }
        
        return true;
    }
    
    sendFeedback(sender, "❌ Perintah tidak valid. Gunakan *!help* untuk melihat daftar perintah.");
    return true;
}