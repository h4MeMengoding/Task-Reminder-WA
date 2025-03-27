/**
 * File ini berisi fungsi-fungsi untuk menangani kesalahan dan pemeriksaan keberadaan event
 */

/**
 * Membersihkan ID event yang tidak valid
 * Fungsi ini akan memeriksa semua ID event yang tersimpan dan menghapus yang tidak valid
 */
function cleanupInvalidEventIds() {
    var eventIds = PropertiesService.getScriptProperties().getProperty('eventIds');
    if (!eventIds) {
        Logger.log("Tidak ada event IDs yang tersimpan");
        return "Tidak ada event IDs yang tersimpan";
    }
    
    eventIds = JSON.parse(eventIds);
    var cleanEventIds = {};
    var deletedCount = 0;
    var users = getUserData();
    
    // Group event IDs by user
    var userEvents = {};
    
    for (var taskId in eventIds) {
        var parts = taskId.split("_");
        if (parts.length >= 3) {
            var userNumber = parts[1];
            if (!userEvents[userNumber]) userEvents[userNumber] = [];
            
            userEvents[userNumber].push({
                taskId: taskId,
                eventId: eventIds[taskId]
            });
        } else {
            // Format ID lama, tambahkan ke daftar untuk dihapus
            deletedCount++;
        }
    }
    
    // Periksa event untuk setiap user
    for (var userNumber in userEvents) {
        var user = getUser(userNumber);
        if (!user || !user.calendarId) {
            // User tidak valid atau tidak memiliki calendar ID, hapus semua event
            deletedCount += userEvents[userNumber].length;
            continue;
        }
        
        try {
            var calendar = CalendarApp.getCalendarById(user.calendarId);
            if (!calendar) {
                // Calendar tidak valid, hapus semua event user
                deletedCount += userEvents[userNumber].length;
                continue;
            }
            
            // Periksa event satu per satu
            for (var i = 0; i < userEvents[userNumber].length; i++) {
                var entry = userEvents[userNumber][i];
                try {
                    var event = calendar.getEventById(entry.eventId);
                    if (event) {
                        // Event valid, simpan
                        cleanEventIds[entry.taskId] = entry.eventId;
                    } else {
                        // Event tidak ditemukan
                        deletedCount++;
                    }
                } catch (e) {
                    // Error saat mengakses event
                    deletedCount++;
                }
            }
        } catch (e) {
            Logger.log("❌ Error saat mengakses calendar user " + userNumber + ": " + e.toString());
            // Asumsikan semua event tidak valid
            deletedCount += userEvents[userNumber].length;
        }
    }
    
    // Simpan kembali event IDs yang valid
    PropertiesService.getScriptProperties().setProperty('eventIds', JSON.stringify(cleanEventIds));
    
    var message = "Pembersihan ID event selesai: " + deletedCount + " event ID tidak valid dihapus";
    Logger.log(message);
    return message;
}

/**
 * Fungsi untuk memeriksa apakah event calendar masih valid
 * @param {string} eventId - ID event calendar
 * @param {string} calendarId - ID calendar
 * @return {boolean} - true jika event valid, false jika tidak
 */
function isEventValid(eventId, calendarId) {
    if (!eventId || !calendarId) return false;
    
    try {
        var calendar = CalendarApp.getCalendarById(calendarId);
        if (!calendar) return false;
        
        var event = calendar.getEventById(eventId);
        return !!event; // Konversi ke boolean
    } catch (e) {
        Logger.log("❌ Error saat memeriksa event: " + e.toString());
        return false;
    }
}

/**
 * Fungsi untuk menguji sambungan ke calendar dan eventIds
 * Berguna untuk debugging masalah calendar
 */
function testCalendarConnection() {
    var results = [];
    var users = getUserData();
    
    // Test koneksi ke calendar setiap user
    for (var number in users) {
        var user = users[number];
        results.push("User: " + user.nama);
        
        if (!user.calendarId) {
            results.push("❌ Calendar ID tidak ditemukan");
            continue;
        }
        
        try {
            var calendar = CalendarApp.getCalendarById(user.calendarId);
            if (calendar) {
                results.push("✅ Calendar ditemukan: " + calendar.getName());
                
                // Test membuat event
                try {
                    var tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    var testEvent = calendar.createAllDayEvent(
                        "Test Event - " + new Date().toISOString(),
                        tomorrow,
                        {description: "Test event, akan otomatis dihapus"}
                    );
                    
                    // Verifikasi event berhasil dibuat
                    var eventId = testEvent.getId();
                    if (eventId) {
                        results.push("✅ Test event berhasil dibuat dengan ID: " + eventId);
                        
                        // Hapus test event
                        testEvent.deleteEvent();
                        results.push("✅ Test event berhasil dihapus");
                    } else {
                        results.push("❌ Gagal mendapatkan ID event");
                    }
                } catch (eventError) {
                    results.push("❌ Error saat membuat test event: " + eventError.toString());
                }
            } else {
                results.push("❌ Calendar tidak ditemukan dengan ID: " + user.calendarId);
            }
        } catch (calError) {
            results.push("❌ Error saat mengakses calendar: " + calError.toString());
        }
        
        results.push("-------------------");
    }
    
    // Tampilkan hasil
    var message = results.join("\n");
    Logger.log(message);
    return message;
}

/**
 * Memastikan semua tugas di sheet memiliki event calendar yang valid
 * Berguna untuk memperbaiki tugas yang tidak muncul di calendar
 * @param {string} whatsappNumber - Nomor WhatsApp pengguna
 * @return {object} - Hasil sinkronisasi
 */
function verifyAllTaskEvents(whatsappNumber) {
    var user = getUser(whatsappNumber);
    if (!user) {
        return {
            success: false,
            message: "User tidak ditemukan"
        };
    }
    
    var calendarId = user.calendarId;
    if (!calendarId) {
        return {
            success: false,
            message: "Calendar ID tidak ditemukan untuk user " + user.nama
        };
    }
    
    try {
        var calendar = CalendarApp.getCalendarById(calendarId);
        if (!calendar) {
            return {
                success: false,
                message: "Calendar tidak valid atau tidak dapat diakses"
            };
        }
        
        var sheetReminder = getSheetForUser(whatsappNumber, "reminder");
        var startRow = 10;
        var endRow = 40;
        var tasks = sheetReminder.getRange(startRow, 2, endRow - startRow + 1, 3).getValues();
        
        var fixed = 0;
        var skipped = 0;
        var errors = 0;
        
        for (var i = 0; i < tasks.length; i++) {
            var isChecked = tasks[i][0];
            var deadline = tasks[i][1];
            var taskName = tasks[i][2];
            
            // Skip tugas kosong atau sudah selesai
            if (!deadline || !taskName || isChecked) {
                skipped++;
                continue;
            }
            
            var row = startRow + i;
            var taskId = "TASK_" + whatsappNumber + "_" + row;
            var eventId = getEventId(taskId);
            
            try {
                // Periksa apakah event sudah ada dan valid
                var eventValid = false;
                
                if (eventId) {
                    try {
                        var event = calendar.getEventById(eventId);
                        if (event) {
                            eventValid = true;
                            Logger.log("✅ Event sudah valid untuk tugas: " + taskName);
                        }
                    } catch (eventError) {
                        Logger.log("⚠️ Event tidak valid: " + eventError.toString());
                        // Hapus ID event yang tidak valid
                        deleteEventIdData(taskId);
                        eventId = null;
                    }
                }
                
                // Buat event baru jika belum ada atau tidak valid
                if (!eventValid) {
                    var newEvent = calendar.createAllDayEvent(
                        "📝 " + taskName,
                        new Date(deadline),
                        {
                            description: "Tugas dari Reminder WA (Auto Fix)",
                            color: CalendarApp.EventColor.PALE_RED
                        }
                    );
                    
                    // Simpan ID event baru
                    saveEventId(taskId, newEvent.getId());
                    Logger.log("✅ Event baru dibuat untuk tugas: " + taskName);
                    fixed++;
                }
            } catch (e) {
                Logger.log("❌ Error saat memverifikasi tugas: " + taskName + " - " + e.toString());
                errors++;
            }
        }
        
        return {
            success: true,
            message: "Verifikasi selesai:\n✅ " + fixed + " tugas diperbaiki\n⏩ " + skipped + " tugas dilewati\n❌ " + errors + " error"
        };
    } catch (e) {
        return {
            success: false,
            message: "Gagal memverifikasi tugas: " + e.toString()
        };
    }
}

/**
 * Fungsi untuk memeriksa Status sinkronisasi kalender
 * Menampilkan informasi tentang tugas di sheet dan event di kalender
 */
function checkCalendarSyncStatus(whatsappNumber) {
    var user = getUser(whatsappNumber);
    if (!user) {
        return "❌ User tidak ditemukan";
    }
    
    var results = ["📊 Status Sinkronisasi Calendar untuk " + user.nama];
    var calendarId = user.calendarId;
    
    if (!calendarId) {
        results.push("❌ Calendar ID tidak ditemukan");
        return results.join("\n");
    }
    
    try {
        var calendar = CalendarApp.getCalendarById(calendarId);
        if (!calendar) {
            results.push("❌ Calendar tidak valid atau tidak dapat diakses");
            return results.join("\n");
        }
        
        results.push("✅ Calendar ditemukan: " + calendar.getName());
        
        var sheetReminder = getSheetForUser(whatsappNumber, "reminder");
        var startRow = 10;
        var endRow = 40;
        var tasks = sheetReminder.getRange(startRow, 2, endRow - startRow + 1, 3).getValues();
        
        var activeTasks = 0;
        var validEvents = 0;
        var invalidEvents = 0;
        var missingEvents = 0;
        
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i][1] && tasks[i][2] && !tasks[i][0]) {
                activeTasks++;
                var taskId = "TASK_" + whatsappNumber + "_" + (startRow + i);
                var eventId = getEventId(taskId);
                
                if (eventId) {
                    try {
                        var event = calendar.getEventById(eventId);
                        if (event) {
                            validEvents++;
                        } else {
                            invalidEvents++;
                        }
                    } catch (e) {
                        invalidEvents++;
                    }
                } else {
                    missingEvents++;
                }
            }
        }
        
        results.push("📝 Total tugas aktif: " + activeTasks);
        results.push("✅ Event valid: " + validEvents);
        results.push("❌ Event tidak valid: " + invalidEvents);
        results.push("⚠️ Tugas tanpa event: " + missingEvents);
        
        if (invalidEvents > 0 || missingEvents > 0) {
            results.push("\n💡 Untuk memperbaiki masalah, jalankan fungsi:");
            results.push("   verifyAllTaskEvents('" + whatsappNumber + "')");
        } else if (activeTasks > 0 && validEvents === activeTasks) {
            results.push("\n✅ Semua tugas tersinkronisasi dengan baik!");
        }
        
        return results.join("\n");
    } catch (e) {
        return "❌ Error: " + e.toString();
    }
}
