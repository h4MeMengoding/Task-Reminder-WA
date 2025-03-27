function updateCalendarEvent(row, deadline, taskName, existingEventId, whatsappNumber) {
    var user = getUser(whatsappNumber);
    if (!user || !user.calendarId) return;
    
    var calendarId = user.calendarId;
    var sheetReminder = getSheetForUser(whatsappNumber, "reminder");

    var calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) return;

    try {
        // Ambil data waktu (jam) jika ada
        var timeStr = sheetReminder.getRange(row, 6).getValue();
        var isAllDay = !timeStr;
        var eventDate = new Date(deadline);
        
        // Jika ada jam, gunakan untuk event calendar
        if (!isAllDay && typeof timeStr === 'string' && timeStr.includes(':')) {
            var timeParts = timeStr.split(':');
            var hours = parseInt(timeParts[0], 10);
            var minutes = parseInt(timeParts[1], 10);
            eventDate.setHours(hours, minutes, 0, 0);
        }

        // Hapus event lama jika ada
        if (existingEventId) {
            try {
                deleteCalendarEvent(existingEventId, whatsappNumber);
            } catch (e) {
                // Abaikan kesalahan saat menghapus event lama
                Logger.log("⚠️ Tidak dapat menghapus event lama: " + e.toString());
                deleteEventIdData("TASK_" + whatsappNumber + "_" + row); // Hapus referensi event yang tidak ada
            }
        }

        // Buat event baru dengan waktu yang sesuai
        var event;
        if (isAllDay) {
            // Buat event all-day
            event = calendar.createAllDayEvent(
                "📝 " + taskName,
                new Date(deadline),
                {
                    description: "Tugas dari Reminder WA",
                    color: CalendarApp.EventColor.PALE_RED
                }
            );
        } else {
            // Buat event dengan waktu spesifik - durasi 1 jam
            var endTime = new Date(eventDate.getTime() + (60 * 60 * 1000));
            event = calendar.createEvent(
                "📝 " + taskName,
                eventDate,
                endTime,
                {
                    description: "Tugas dari Reminder WA",
                    color: CalendarApp.EventColor.PALE_RED
                }
            );
        }

        // Simpan Event ID ke sheet DATA CALENDAR
        var taskId = "TASK_" + whatsappNumber + "_" + row;
        saveEventId(taskId, event.getId());

        Logger.log("✅ Berhasil memperbarui event calendar: " + taskName + (isAllDay ? "" : " pada " + timeStr));
    } catch (e) {
        Logger.log("❌ Gagal memperbarui event calendar: " + e.toString());
    }
}

function deleteCalendarEvent(eventId, whatsappNumber) {
    if (!eventId) return;

    var user = getUser(whatsappNumber);
    if (!user || !user.calendarId) return;

    var calendarId = user.calendarId;

    var calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) return;

    try {
        var event = calendar.getEventById(eventId);
        if (event) {
            event.deleteEvent();
            Logger.log("✅ Berhasil menghapus event calendar");
        } else {
            Logger.log("⚠️ Event dengan ID " + eventId + " tidak ditemukan");
        }
    } catch (e) {
        Logger.log("❌ Gagal menghapus event calendar: " + e.toString());
        throw new Error("Gagal menghapus event calendar: " + e.message);
    }
}

function forceCalendarAuth() {
    var calendarId = getCalendarId();

    if (!calendarId) {
        throw new Error("Calendar ID belum diisi di sheet SETUP cell C11.\n\nCara mendapatkan Calendar ID:\n1. Buka Google Calendar\n2. Klik roda gigi (Settings)\n3. Klik calendar yang ingin digunakan\n4. Scroll ke bagian 'Integrate calendar'\n5. Copy Calendar ID\n\nContoh Calendar ID:\n- Primary: your.email@gmail.com\n- Custom: abcd1234@group.calendar.google.com");
    }

    try {
        // Cek apakah calendar dengan ID tersebut ada
        var calendar = CalendarApp.getCalendarById(calendarId);
        if (!calendar) {
            throw new Error("Calendar dengan ID " + calendarId + " tidak ditemukan.\n\nPastikan:\n1. Calendar ID sudah benar\n2. Calendar tersebut ada di akun Anda\n3. Anda memiliki akses ke calendar tersebut");
        }

        // Test akses ke calendar
        var now = new Date();
        var tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
        var events = calendar.getEvents(now, tomorrow);

        Logger.log("✅ Berhasil terautentikasi dengan Google Calendar");
        Logger.log("📅 Nama Calendar: " + calendar.getName());
        return "Berhasil terhubung ke Google Calendar: " + calendar.getName();
    } catch (error) {
        Logger.log("❌ Gagal autentikasi: " + error.toString());
        if (error.message.includes("Calendar not found")) {
            throw new Error("Calendar tidak ditemukan. Pastikan Calendar ID benar dan Anda memiliki akses ke calendar tersebut.");
        }
        throw error;
    }
}

function verifyCalendarId() {
    var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
    var calendarId = getCalendarId();
    // Ketika memverifikasi calendar ID baru, hapus cache
    clearCalendarIdCache();

    // Test dengan calendar pribadi jika tidak ada ID
    if (!calendarId) {
        try {
            var defaultCalendar = CalendarApp.getDefaultCalendar();
            sheetSetup.getRange("C11").setValue(defaultCalendar.getId());
            Logger.log("✅ Menggunakan calendar default: " + defaultCalendar.getName());
            return "Berhasil mengatur calendar default: " + defaultCalendar.getName();
        } catch (e) {
            Logger.log("❌ Gagal mengatur calendar default: " + e.toString());
            throw new Error("Gagal mengatur calendar default. Silakan isi Calendar ID secara manual.");
        }
    }

    return forceCalendarAuth();
}

function syncAllTasksToCalendar(whatsappNumber) {
    if (!whatsappNumber) {
        // Sinkronisasi untuk semua pengguna
        var users = getUserData();
        var results = [];
        
        for (var number in users) {
            try {
                var result = syncUserTasksToCalendar(number);
                results.push(users[number].nama + ": " + result);
            } catch (e) {
                results.push(users[number].nama + ": ❌ " + e.message);
            }
        }
        
        return results.join("\n\n");
    } else {
        // Sinkronisasi untuk pengguna tertentu
        return syncUserTasksToCalendar(whatsappNumber);
    }
}

function syncUserTasksToCalendar(whatsappNumber) {
    var user = getUser(whatsappNumber);
    if (!user) {
        throw new Error("User tidak ditemukan");
    }
    
    var sheetReminder = getSheetForUser(whatsappNumber, "reminder");
    var calendarId = user.calendarId;

    if (!calendarId) {
        throw new Error("Calendar ID belum diatur untuk user ini.");
    }

    var calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
        throw new Error("Calendar tidak ditemukan.");
    }

    // Ambil semua tugas dari sheet REMINDER
    var startRow = 10;
    var endRow = 40;
    var tasks = sheetReminder.getRange(startRow, 2, endRow - startRow + 1, 5).getValues();
    var berhasil = 0;
    var gagal = 0;

    for (var i = 0; i < tasks.length; i++) {
        var isChecked = tasks[i][0];
        var deadline = tasks[i][1];
        var taskName = tasks[i][2];
        var taskId = "TASK_" + whatsappNumber + "_" + (startRow + i); // ID unik untuk setiap tugas
        var existingEventId = getEventId(taskId); // Dapatkan Event ID dari sheet DATA CALENDAR

        // Skip baris kosong atau tugas yang sudah selesai
        if (!deadline || !taskName || isChecked) continue;

        try {
            // Jika sudah ada event ID, skip
            if (!existingEventId) {
                // Ambil waktu dari kolom F - indeks 4 disini karena array tasks mulai dari kolom B
                var timeStr = tasks[i][4]; // Kolom F (indeks 4 relatif terhadap range)
                var isAllDay = !timeStr;
                var eventDate = new Date(deadline);
                
                // Jika ada jam, gunakan untuk event calendar
                if (!isAllDay && typeof timeStr === 'string' && timeStr.includes(':')) {
                    var timeParts = timeStr.split(':');
                    var hours = parseInt(timeParts[0], 10);
                    var minutes = parseInt(timeParts[1], 10);
                    eventDate.setHours(hours, minutes, 0, 0);
                }
                
                var event;
                if (isAllDay) {
                    event = calendar.createAllDayEvent(
                        "📝 " + taskName,
                        new Date(deadline),
                        {
                            description: "Tugas dari Reminder WA",
                            color: CalendarApp.EventColor.PALE_RED
                        }
                    );
                } else {
                    var endTime = new Date(eventDate.getTime() + (60 * 60 * 1000)); // 1 jam durasi
                    event = calendar.createEvent(
                        "📝 " + taskName,
                        eventDate,
                        endTime,
                        {
                            description: "Tugas dari Reminder WA",
                            color: CalendarApp.EventColor.PALE_RED
                        }
                    );
                }
                
                // Simpan Event ID ke sheet DATA CALENDAR
                saveEventId(taskId, event.getId());
                berhasil++;
                Logger.log("✅ Berhasil menambahkan: " + taskName);
            }
        } catch (e) {
            gagal++;
            Logger.log("❌ Gagal menambahkan " + taskName + ": " + e.toString());
        }
    }

    var message = "Sinkronisasi selesai!\n"
        + "✅ Berhasil: " + berhasil + " tugas\n"
        + "❌ Gagal: " + gagal + " tugas\n"
        + "📅 Calendar: " + calendar.getName();

    Logger.log(message);
    return message;
}

function setupCalendarConfig() {
    try {
        Logger.log("🔄 Memulai konfigurasi calendar...");

        // Step 1: Verifikasi dan setup Calendar ID
        Logger.log("\n📅 Step 1: Verifikasi Calendar ID");
        var calendarResult = verifyCalendarId();
        Logger.log(calendarResult);

        // Tunggu 2 detik untuk memastikan Calendar ID tersimpan
        Utilities.sleep(2000);

        // Verifikasi Calendar ID sudah tersimpan
        var calendarId = getCalendarId();
        if (!calendarId) {
            throw new Error("Calendar ID gagal disimpan. Silakan coba lagi.");
        }

        // Step 2: Force Calendar Auth
        Logger.log("\n🔐 Step 2: Autentikasi Calendar");
        var authResult = forceCalendarAuth();
        Logger.log(authResult);

        // Tunggu 2 detik untuk memastikan autentikasi selesai
        Utilities.sleep(2000);

        // Step 3: Hapus trigger lama sebelum membuat yang baru
        var triggers = ScriptApp.getProjectTriggers();
        triggers.forEach(function (trigger) {
            if (trigger.getHandlerFunction() === "onEditWithAuth") {
                ScriptApp.deleteTrigger(trigger);
            }
        });

        // Tunggu 1 detik setelah menghapus trigger
        Utilities.sleep(1000);

        Logger.log("\n⚡ Step 3: Setup Edit Trigger");
        var triggerResult = createEditTrigger();
        Logger.log(triggerResult);

        // Verifikasi trigger berhasil dibuat
        var newTriggers = ScriptApp.getProjectTriggers();
        var triggerExists = false;
        newTriggers.forEach(function (trigger) {
            if (trigger.getHandlerFunction() === "onEditWithAuth") {
                triggerExists = true;
            }
        });

        if (!triggerExists) {
            throw new Error("Trigger gagal dibuat. Silakan coba lagi.");
        }

        // Tunggu 2 detik sebelum sync
        Utilities.sleep(2000);

        // Step 4: Sync existing tasks
        Logger.log("\n🔄 Step 4: Sinkronisasi tugas yang ada");
        var syncResult = syncAllTasksToCalendar();
        Logger.log(syncResult);

        var successMessage = "✅ Konfigurasi calendar berhasil!\n\n"
            + "1. Calendar ID: " + calendarId + "\n"
            + "2. Autentikasi: OK\n"
            + "3. Edit trigger: OK\n"
            + "4. Sinkronisasi: OK\n\n"
            + "System siap digunakan! 🚀";

        Logger.log("\n" + successMessage);
        return successMessage;

    } catch (error) {
        var errorMessage = "❌ Gagal melakukan konfigurasi:\n" + error.message + "\n\n"
            + "Silakan coba lagi atau jalankan fungsi secara terpisah:\n"
            + "1. verifyCalendarId()\n"
            + "2. forceCalendarAuth()\n"
            + "3. createEditTrigger()";
        Logger.log(errorMessage);
        throw new Error(errorMessage);
    }
}
