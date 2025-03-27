function moveCompletedTasks(whatsappNumber) {
    var user = getUser(whatsappNumber);
    
    if (!user) {
        Logger.log("⚠️ User tidak ditemukan: " + whatsappNumber);
        return;
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetReminder = getSheetForUser(whatsappNumber, "reminder");
    var sheetDone = getSheetForUser(whatsappNumber, "done");
    var sheetSetup = ss.getSheetByName("SETUP");
    var calendarId = user.calendarId;
    var noWhatsApp = whatsappNumber;
    var namaUser = user.nama;

    var startRow = 10;
    var endRow = 40;
    var checkCol = 2;
    var deadlineCol = 3;
    var taskCol = 4;

    var valuesReminder = sheetReminder.getRange(startRow, checkCol, endRow - startRow + 1, 3).getValues();
    var doneData = sheetDone.getRange(startRow, checkCol, endRow - startRow + 1, 3).getValues();

    var newDoneData = [];
    var reminderClearedRows = [];
    var insertedIndexes = new Set();
    var completedTaskMessages = []; // Array untuk menyimpan pesan tugas yang selesai
    // Tambahkan flag untuk mengetahui apakah ini dipanggil dari perintah !selesai
    var isFromCommand = arguments.length > 1 && arguments[1] === true;

    for (var i = 0; i < valuesReminder.length; i++) {
        if (valuesReminder[i][0] === true) {
            var taskId = "TASK_" + whatsappNumber + "_" + (i + startRow);

            // Cek apakah tugas sudah diproses sebelumnya
            if (isTaskAlreadyCompleted(taskId)) {
                Logger.log("⚠️ Tugas sudah diproses sebelumnya: " + valuesReminder[i][2]);
                continue;
            }

            // Gunakan waktu saat ini untuk pesan notifikasi
            var now = new Date();
            var bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
            var tanggal = now.getDate();
            var bulan = bulanIndo[now.getMonth()];
            var tahun = now.getFullYear();
            var jam = Utilities.formatDate(now, "GMT+7", "HH:mm");
            var tanggalFormatted = tanggal + " " + bulan + " " + tahun + " " + jam;

            // Simpan pesan tugas selesai hanya jika berasal dari perintah !selesai
            if (isFromCommand) {
                var taskMessage = "✅ Tugas *" + valuesReminder[i][2] + "* selesai pada *" + tanggalFormatted + "*";
                completedTaskMessages.push(taskMessage);
            }

            // Proses calendar
            if (calendarId) {
                var calendar = CalendarApp.getCalendarById(calendarId);
                var eventId = getEventId(taskId);
                if (calendar && eventId) {
                    try {
                        var event = calendar.getEventById(eventId);
                        if (event) {
                            // Cek apakah judul sudah memiliki emoji ✅
                            var currentTitle = event.getTitle();
                            if (!currentTitle.startsWith('✅')) {
                                var cleanTitle = currentTitle.replace(/^📝\s*/, '').trim();
                                event.setTitle("✅ " + cleanTitle);
                                event.setColor(CalendarApp.EventColor.GRAY);
                                Logger.log("✅ Event calendar berhasil diupdate: " + cleanTitle);
                            }
                        } else {
                            Logger.log("⚠️ Event tidak ditemukan untuk taskId: " + taskId);
                            deleteEventIdData(taskId); // Hapus referensi event yang tidak ada
                        }
                    } catch (e) {
                        Logger.log("❌ Error updating calendar event: " + e.toString());
                        deleteEventIdData(taskId); // Hapus referensi event yang error
                    }
                }
            }
            newDoneData.push([true, valuesReminder[i][1], valuesReminder[i][2]]);
            reminderClearedRows.push(i + startRow);
        }
    }

    if (newDoneData.length > 0) {
        var doneInsertIndex = 0;
        for (var j = 0; j < doneData.length; j++) {
            if (doneData[j][1] === "" && doneInsertIndex < newDoneData.length) {
                if (!insertedIndexes.has(startRow + j)) {
                    sheetDone.getRange(startRow + j, checkCol, 1, 3).setValues([newDoneData[doneInsertIndex]]);
                    insertedIndexes.add(startRow + j);
                    doneInsertIndex++;
                }
            }
        }

        // Kirim notifikasi WhatsApp hanya jika dipanggil dari perintah !selesai
        if (completedTaskMessages.length > 0 && noWhatsApp && isFromCommand) {
            Utilities.sleep(100); // Tunggu sebentar sebelum mengirim pesan
            sendFeedback(noWhatsApp, completedTaskMessages.join("\n"));
        }

        SpreadsheetApp.flush();
        for (var k = 0; k < reminderClearedRows.length; k++) {
            var row = reminderClearedRows[k];
            sheetReminder.getRange(row, checkCol, 1, 3).setValues([[false, "", ""]]);
        }
        // Panggil fungsi untuk mengurutkan tugas berdasarkan deadline setelah tugas selesai dipindahkan
        sortTasksByDeadline(whatsappNumber);
    }
}

function sortTasksByDeadline(whatsappNumber) {
    var sheet = getSheetForUser(whatsappNumber, "reminder");
    if (!sheet) return;

    var startRow = 10;
    var endRow = 40;
    
    // Ambil data dari kolom B-E (checkbox, deadline, task, notes)
    var dataRange = sheet.getRange(startRow, 2, endRow - startRow + 1, 4);
    var values = dataRange.getValues();
    
    // Jika kolom formula ada (kolom E), simpan formula-nya
    var formulas = [];
    try {
        formulas = sheet.getRange(startRow, 5, endRow - startRow + 1, 1).getFormulas();
    } catch (e) {
        Logger.log("Info: Tidak ada formula di kolom E yang perlu disimpan");
    }
    
    // Ambil data waktu dari kolom F (jam)
    var timeValues = sheet.getRange(startRow, 6, endRow - startRow + 1, 1).getValues();

    // Gabungkan data deadline, task, dan waktu untuk sorting
    var tasksData = [];
    for (var i = 0; i < values.length; i++) {
        if (values[i][1] && values[i][2]) { // Jika ada deadline dan nama tugas
            tasksData.push({
                index: i,
                checkbox: values[i][0],
                deadline: values[i][1],
                task: values[i][2],
                notes: values[i][3] || "", // Pastikan ada nilai notes, gunakan string kosong jika null
                time: timeValues[i][0]
            });
        }
    }

    // Sort berdasarkan deadline
    tasksData.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    // Siapkan array baru untuk data yang telah diurutkan
    var newData = new Array(values.length).fill().map(() => ["", "", "", ""]);
    var newTimeValues = new Array(values.length).fill().map(() => [""]);

    // Pindahkan data yang sudah diurutkan ke array baru
    for (var i = 0; i < tasksData.length; i++) {
        newData[i] = [
            tasksData[i].checkbox, 
            tasksData[i].deadline, 
            tasksData[i].task, 
            tasksData[i].notes
        ];
        newTimeValues[i] = [tasksData[i].time];
    }

    // Update sheet dengan data yang sudah diurutkan - pastikan range sama dengan yang diambil
    dataRange.setValues(newData);
    sheet.getRange(startRow, 6, endRow - startRow + 1, 1).setValues(newTimeValues);
    
    // Kembalikan formulas jika ada
    if (formulas.length > 0) {
        try {
            sheet.getRange(startRow, 5, endRow - startRow + 1, 1).setFormulas(formulas);
        } catch (e) {
            Logger.log("⚠️ Tidak dapat mengembalikan formula: " + e.toString());
        }
    }
    
    Logger.log("✅ Tasks dan waktu berhasil diurutkan berdasarkan deadline");
}

function moveTaskBackToReminder(doneRow, whatsappNumber) {
    var user = getUser(whatsappNumber);
    if (!user) return;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetDone = getSheetForUser(whatsappNumber, "done");
    var sheetReminder = getSheetForUser(whatsappNumber, "reminder");
    var calendarId = user.calendarId;

    // Get task data from DONE sheet
    var taskData = sheetDone.getRange(doneRow, 2, 1, 3).getValues()[0];

    // Find empty row in REMINDER sheet
    var startRow = 10;
    var endRow = 40;
    var reminderValues = sheetReminder.getRange(startRow, 3, endRow - startRow + 1, 2).getValues();
    var emptyRow = -1;

    for (var i = 0; i < reminderValues.length; i++) {
        if (!reminderValues[i][0] && !reminderValues[i][1]) {
            emptyRow = startRow + i;
            break;
        }
    }

    if (emptyRow !== -1) {
        // Move task to REMINDER sheet
        sheetReminder.getRange(emptyRow, 2, 1, 3).setValues([[false, taskData[1], taskData[2]]]);

        // Update calendar event
        if (calendarId) {
            var calendar = CalendarApp.getCalendarById(calendarId);
            if (calendar) {
                try {
                    // Cari event yang sudah ada
                    var searchStart = new Date(taskData[1]);
                    var searchEnd = new Date(taskData[1]);
                    searchEnd.setDate(searchEnd.getDate() + 1);

                    var events = calendar.getEvents(searchStart, searchEnd);
                    var existingEvent = null;
                    var taskName = taskData[2];

                    // Cari event dengan nama yang sama (tanpa emoji)
                    for (var event of events) {
                        var eventTitle = event.getTitle().replace(/^[✅📝]\s*/, '');
                        if (eventTitle === taskName) {
                            existingEvent = event;
                            break;
                        }
                    }

                    if (existingEvent) {
                        // Update event yang sudah ada
                        existingEvent.setTitle("📝 " + taskName);
                        existingEvent.setColor(CalendarApp.EventColor.PALE_RED);

                        // Simpan Event ID untuk referensi
                        var taskId = "TASK_" + whatsappNumber + "_" + emptyRow;
                        saveEventId(taskId, existingEvent.getId());

                        Logger.log("✅ Event calendar berhasil diubah kembali: " + taskName);
                    }
                } catch (e) {
                    Logger.log("❌ Gagal mengubah event calendar: " + e.toString());
                }
            }
        }

        // Clear data from DONE sheet
        sheetDone.getRange(doneRow, 2, 1, 3).setValues([[false, "", ""]]);

        // Sort tasks in REMINDER sheet
        sortTasksByDeadline(whatsappNumber);

        Logger.log("✅ Tugas berhasil dipindahkan kembali ke REMINDER");
    } else {
        Logger.log("❌ Tidak ada baris kosong di REMINDER");
    }
}

function checkTasksAccess() {
    try {
        // Coba akses Tasks API
        var taskLists = Tasks.Tasklists.list();
        var defaultTaskList = taskLists.items[0];

        Logger.log("✅ Berhasil terhubung ke Google Tasks");
        Logger.log("📝 Default Task List: " + defaultTaskList.title);
        return "Berhasil terhubung ke Google Tasks: " + defaultTaskList.title;
    } catch (error) {
        Logger.log("❌ Gagal akses Tasks API: " + error.toString());
        throw new Error("Gagal akses Tasks API. Pastikan:\n1. Google Tasks API sudah diaktifkan\n2. Anda sudah memberikan izin yang diperlukan");
    }
}

function deleteTask(row, whatsappNumber) {
    var sheet = getSheetForUser(whatsappNumber, "reminder");
    var taskId = "TASK_" + whatsappNumber + "_" + row;
    var eventId = getEventId(taskId);

    try {
        // Hapus event dari calendar jika ada
        if (eventId) {
            try {
                deleteCalendarEvent(eventId, whatsappNumber);
            } catch (e) {
                Logger.log("⚠️ Tidak dapat menghapus event calendar: " + e.toString());
            } finally {
                deleteEventIdData(taskId); // Selalu hapus referensi event
            }
        }

        // Hapus data tugas dari sheet
        sheet.getRange(row, 2, 1, 3).clearContent(); // Hapus checkbox, deadline, dan nama tugas

        // Sort ulang tugas
        sortTasksByDeadline(whatsappNumber);

        Logger.log("✅ Tugas berhasil dihapus dari baris " + row);
    } catch (e) {
        Logger.log("❌ Gagal menghapus tugas: " + e.toString());
        SpreadsheetApp.getActive().toast('❌ Gagal menghapus tugas', 'Error', 3);
    }
}

function isTaskAlreadyCompleted(taskId) {
    var completedTasks = PropertiesService.getScriptProperties().getProperty('completedTasks');
    if (completedTasks) {
        completedTasks = JSON.parse(completedTasks);
        return completedTasks.includes(taskId);
    }
    return false;
}

function saveEventId(taskId, eventId) {
    var eventIds = PropertiesService.getScriptProperties().getProperty('eventIds');
    if (eventIds) {
        eventIds = JSON.parse(eventIds);
    } else {
        eventIds = {};
    }
    eventIds[taskId] = eventId;
    PropertiesService.getScriptProperties().setProperty('eventIds', JSON.stringify(eventIds));
}

function getEventId(taskId) {
    var eventIds = PropertiesService.getScriptProperties().getProperty('eventIds');
    if (eventIds) {
        eventIds = JSON.parse(eventIds);
        return eventIds[taskId];
    }
    return null;
}

function deleteEventIdData(taskId) {
    var eventIds = PropertiesService.getScriptProperties().getProperty('eventIds');
    if (eventIds) {
        eventIds = JSON.parse(eventIds);
        delete eventIds[taskId];
        PropertiesService.getScriptProperties().setProperty('eventIds', JSON.stringify(eventIds));
    }
}

function deleteCalendarEvent(eventId, whatsappNumber) {
    var user = getUser(whatsappNumber);
    if (!user || !user.calendarId) return;
    
    var calendar = CalendarApp.getCalendarById(user.calendarId);
    if (calendar) {
        var event = calendar.getEventById(eventId);
        if (event) {
            event.deleteEvent();
        }
    }
}

function deleteTaskByName(taskName, whatsappNumber) {
    var sheetReminder = getSheetForUser(whatsappNumber, "reminder");
    var startRow = 10;
    var endRow = 40;
    var values = sheetReminder.getRange(startRow, 2, endRow - startRow + 1, 3).getValues();

    for (var i = 0; i < values.length; i++) {
        if (values[i][2] && values[i][2].toString().toLowerCase() === taskName.toLowerCase()) {
            var row = startRow + i;
            var taskId = "TASK_" + whatsappNumber + "_" + row;
            var eventId = getEventId(taskId);

            try {
                // Hapus event dari calendar jika ada
                if (eventId) {
                    try {
                        deleteCalendarEvent(eventId, whatsappNumber);
                    } catch (e) {
                        Logger.log("⚠️ Tidak dapat menghapus event calendar: " + e.toString());
                    } finally {
                        deleteEventIdData(taskId); // Selalu hapus referensi event
                    }
                }

                // Hapus data tugas dari sheet
                sheetReminder.getRange(row, 2, 1, 3).clearContent();

                // Sort ulang tugas
                sortTasksByDeadline(whatsappNumber);

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
