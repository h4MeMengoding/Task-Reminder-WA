function deleteTaskByName(taskName, sender) {
    var sheetReminder = getSheetForUser(sender, "reminder");
    var startRow = 10;
    var endRow = 40;
    var values = sheetReminder.getRange(startRow, 2, endRow - startRow + 1, 3).getValues();

    for (var i = 0; i < values.length; i++) {
        if (values[i][2] && values[i][2].toString().toLowerCase() === taskName.toLowerCase()) {
            var row = startRow + i;
            var taskId = "TASK_" + sender + "_" + row;
            var eventId = getEventId(taskId);

            try {
                // Hapus event dari calendar jika ada
                if (eventId) {
                    try {
                        deleteCalendarEvent(eventId, sender);
                    } catch (e) {
                        Logger.log("⚠️ Tidak dapat menghapus event calendar: " + e.toString());
                    } finally {
                        deleteEventIdData(taskId); // Selalu hapus referensi event
                    }
                }

                // Hapus data tugas dari sheet
                sheetReminder.getRange(row, 2, 1, 3).clearContent();

                // Sort ulang tugas
                sortTasksByDeadline(sender);

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

function getCompletedTasks(whatsappNumber) {
    var user = getUser(whatsappNumber);
    
    if (!user) {
        return "❌ Kamu belum terdaftar. Hubungi admin untuk mendaftar.";
    }
    
    var sheetDone = getSheetForUser(whatsappNumber, "done");
    var values = sheetDone.getRange(10, 2, 31, 3).getValues();
    var completedTasks = [];

    function formatTanggalIndonesia(date) {
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

function addTaskToReminder(deadline, timeStr, taskName, sender) {
    var user = getUser(sender);
    if (!user) {
        Logger.log("❌ User tidak ditemukan: " + sender);
        return {
            success: false,
            message: "❌ Kamu belum terdaftar. Hubungi admin untuk mendaftar."
        };
    }
    
    // Log informasi user untuk debugging
    Logger.log("📝 Info User: " + JSON.stringify(user));
    
    var sheetReminder = getSheetForUser(sender, "reminder");
    var calendarId = user.calendarId;
    
    // Periksa calendar ID
    if (!calendarId) {
        Logger.log("⚠️ Calendar ID tidak ditemukan untuk user: " + sender);
    } else {
        Logger.log("✅ Menggunakan Calendar ID: " + calendarId);
    }
    
    var startRow = 10;
    var endRow = 40;
    var checkCol = 2;
    var deadlineCol = 3;
    var taskCol = 4;
    var timeCol = 6; // Kolom F untuk jam

    var values = sheetReminder.getRange(startRow, checkCol, endRow - startRow + 1, 5).getValues();

    for (var i = 0; i < values.length; i++) {
        if (!values[i][1] && !values[i][2]) {
            try {
                var day, month, year;
                var hours = 0, minutes = 0;
                
                // Parse format tanggal
                if (deadline.length === 4 && /^\d{4}$/.test(deadline)) {
                    // Format DDMM, gunakan tahun sekarang
                    day = parseInt(deadline.substring(0, 2), 10);
                    month = parseInt(deadline.substring(2, 4), 10) - 1;
                    year = new Date().getFullYear(); // Tahun sekarang
                    Logger.log("📅 Menggunakan format DDMM dengan tahun sekarang: " + year);
                } else if (deadline.length === 8 && /^\d{8}$/.test(deadline)) {
                    // Format DDMMYYYY
                    day = parseInt(deadline.substring(0, 2), 10);
                    month = parseInt(deadline.substring(2, 4), 10) - 1;
                    year = parseInt(deadline.substring(4, 8), 10);
                } else {
                    Logger.log("Invalid date format: " + deadline);
                    return {
                        success: false,
                        message: 'Format tanggal salah. Gunakan format: DDMM atau DDMMYYYY'
                    };
                }
                
                // Parse format jam
                var timeValue = null;
                if (timeStr && timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
                    hours = parseInt(timeStr.substring(0, 2), 10);
                    minutes = parseInt(timeStr.substring(2, 4), 10);
                    
                    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                        timeValue = ("0" + hours).slice(-2) + ":" + ("0" + minutes).slice(-2);
                    } else {
                        return {
                            success: false,
                            message: 'Format jam tidak valid. Gunakan format: HHMM (0000-2359)'
                        };
                    }
                }
                
                var date = new Date(year, month, day);

                if (isNaN(date.getTime())) {
                    Logger.log("Invalid date: " + deadline);
                    return {
                        success: false,
                        message: 'Tanggal tidak valid. Pastikan tanggal dan bulan sudah benar.'
                    };
                }

                // Jika jam valid, tambahkan ke tanggal untuk event calendar
                var eventDate = new Date(date);
                if (timeValue) {
                    eventDate.setHours(hours, minutes, 0, 0);
                }

                // Update spreadsheet in batch
                var row = startRow + i;
                var taskId = "TASK_" + sender + "_" + row;
                
                // Set tanggal dan tugas
                sheetReminder.getRange(row, deadlineCol, 1, 2).setValues([[date, taskName]]);
                
                // Set jam jika ada
                if (timeValue) {
                    sheetReminder.getRange(row, timeCol).setValue(timeValue);
                }

                // Pastikan update spreadsheet selesai
                SpreadsheetApp.flush();
                // Tunggu sebentar untuk memastikan data tersimpan
                Utilities.sleep(200);

                // Handle calendar event
                if (calendarId) {
                    Logger.log("📅 Mencoba membuat event calendar untuk: " + taskName);
                    try {
                        var calendar = CalendarApp.getCalendarById(calendarId);
                        if (calendar) {
                            var existingEventId = getEventId(taskId);
                            
                            // Cek apakah event sudah ada
                            if (existingEventId) {
                                try {
                                    // Coba update event yang sudah ada
                                    var existingEvent = calendar.getEventById(existingEventId);
                                    if (existingEvent) {
                                        if (timeValue) {
                                            // Update event dengan waktu spesifik
                                            existingEvent.setTitle("📝 " + taskName);
                                            existingEvent.setTime(eventDate, new Date(eventDate.getTime() + 60*60*1000)); // 1 jam durasi
                                            existingEvent.setColor(CalendarApp.EventColor.PALE_RED);
                                        } else {
                                            // Update event sebagai all-day
                                            existingEvent.setTitle("📝 " + taskName);
                                            existingEvent.setAllDayDate(date);
                                            existingEvent.setColor(CalendarApp.EventColor.PALE_RED);
                                        }
                                        Logger.log("📅 Event berhasil diupdate: " + existingEventId);
                                    } else {
                                        // Event tidak ditemukan, buat baru
                                        throw new Error("Event tidak ditemukan");
                                    }
                                } catch (updateError) {
                                    // Jika gagal update, hapus ID lama dan buat baru
                                    Logger.log("⚠️ Gagal update event, membuat baru: " + updateError.toString());
                                    deleteEventIdData(taskId);
                                    existingEventId = null;
                                }
                            }
                            
                            // Buat event baru jika belum ada
                            if (!existingEventId) {
                                var event;
                                
                                if (timeValue) {
                                    // Buat event dengan waktu spesifik
                                    event = calendar.createEvent(
                                        "📝 " + taskName,
                                        eventDate,
                                        new Date(eventDate.getTime() + 60*60*1000), // 1 jam durasi
                                        {
                                            description: "Tugas dari Reminder WA",
                                            color: CalendarApp.EventColor.PALE_RED
                                        }
                                    );
                                } else {
                                    // Buat event all-day
                                    event = calendar.createAllDayEvent(
                                        "📝 " + taskName,
                                        date,
                                        {
                                            description: "Tugas dari Reminder WA",
                                            color: CalendarApp.EventColor.PALE_RED
                                        }
                                    );
                                }

                                // Periksa apakah event berhasil dibuat
                                if (!event || !event.getId()) {
                                    throw new Error("Gagal membuat event calendar");
                                }
                                
                                Logger.log("📅 Event berhasil dibuat dengan ID: " + event.getId());
                                saveEventId(taskId, event.getId());
                                
                                // Tunggu sebentar setelah pembuatan event
                                Utilities.sleep(300);
                            }
                        } else {
                            Logger.log("❌ Calendar tidak ditemukan dengan ID: " + calendarId);
                        }
                    } catch (e) {
                        Logger.log("❌ Error saat membuat event calendar: " + e.toString());
                        // Tetap lanjutkan meski gagal membuat event
                    }
                }

                // Format tanggal dan jam untuk respons
                var hariIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
                var bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
                    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

                var hari = hariIndo[date.getDay()];
                var tanggal = date.getDate();
                var bulan = bulanIndo[date.getMonth()];
                var tahun = date.getFullYear();

                var tanggalFormatted = hari + ", " + tanggal + " " + bulan + " " + tahun;
                var responseMessage = "Berhasil menambahkan tugas " + "*" + taskName + "*" + " dengan deadline " + "*" + tanggalFormatted;
                
                // Tampilkan jam jika ada
                if (timeValue) {
                    responseMessage += " pukul " + timeValue + "*";
                } else {
                    responseMessage += "*";
                }

                Logger.log("Task added successfully: " + responseMessage);

                // Sort tugas setelah penambahan
                sortTasksByDeadline(sender);

                return {
                    success: true,
                    message: responseMessage
                };
            } catch (error) {
                Logger.log("Error adding task: " + error.toString());
                return {
                    success: false,
                    message: 'Terjadi kesalahan saat menambahkan tugas: ' + error.message
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