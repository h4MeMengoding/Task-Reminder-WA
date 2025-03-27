function createEditTrigger() {
    // Hapus trigger lama jika ada
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function (trigger) {
        if (trigger.getHandlerFunction() === "onEditWithAuth") {
            ScriptApp.deleteTrigger(trigger);
        }
    });

    // Buat trigger baru
    ScriptApp.newTrigger("onEditWithAuth")
        .forSpreadsheet(SpreadsheetApp.getActive())
        .onEdit()
        .create();

    Logger.log("✅ Edit trigger berhasil dibuat");
    return "Edit trigger berhasil dibuat";
}

function onEditWithAuth(e) {
    if (!e || !e.source) return;

    var sheet = e.source.getActiveSheet();
    var range = e.range;
    var row = range.getRow();
    var col = range.getColumn();
    var sheetName = sheet.getName();
    
    // Deteksi jenis sheet dan nomor WA yang terkait
    var whatsappNumber = null;
    var isReminderSheet = false;
    var isDoneSheet = false;
    
    // Cek sheet USERS untuk menentukan pemilik sheet
    var users = getUserData();
    for (var number in users) {
        var user = users[number];
        if (sheetName === user.reminderSheet) {
            whatsappNumber = number;
            isReminderSheet = true;
            break;
        } else if (sheetName === user.doneSheet) {
            whatsappNumber = number;
            isDoneSheet = true;
            break;
        }
    }
    
    // Handle sheet lama (backward compatibility)
    if (sheetName === "REMINDER") {
        isReminderSheet = true;
        // Gunakan nomor WA default dari SETUP
        var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
        whatsappNumber = sheetSetup.getRange("C3").getValue();
    } else if (sheetName === "DONE") {
        isDoneSheet = true;
        // Gunakan nomor WA default dari SETUP
        var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
        whatsappNumber = sheetSetup.getRange("C3").getValue();
    }
    
    if (!whatsappNumber) return; // Jika bukan sheet reminder atau done
    
    // Handle REMINDER sheet edits
    if (isReminderSheet && row >= 10 && row <= 40) {
        if (col === 2) { // Checkbox column
            if (range.getValue() === true) {
                moveCompletedTasks(whatsappNumber); // Langsung panggil moveCompletedTasks dengan nomor WA
                return;
            }
        } else if (col === 7) { // Kolom F - Delete checkbox
            if (range.getValue() === true) {
                var ui = SpreadsheetApp.getUi();
                var response = ui.alert(
                    'Konfirmasi',
                    'Yakin ingin menghapus tugas ini?',
                    ui.ButtonSet.YES_NO
                );

                if (response == ui.Button.YES) {
                    deleteTask(row, whatsappNumber);
                    range.setValue(false); // Reset checkbox
                } else {
                    range.setValue(false); // Reset checkbox jika user memilih No
                }
            }
        } else if (col === 3 || col === 4) { // Deadline or task name column
            var deadline = sheet.getRange(row, 3).getValue();
            var task = sheet.getRange(row, 4).getValue();
            var taskId = "TASK_" + whatsappNumber + "_" + row; // ID unik untuk setiap tugas
            var eventId = getEventId(taskId); // Dapatkan Event ID dari sheet DATA CALENDAR

            // Update atau buat event calendar jika ada deadline dan nama tugas
            if (deadline && task) {
                try {
                    updateCalendarEvent(row, deadline, task, eventId, whatsappNumber);
                    sortTasksByDeadline(whatsappNumber);
                } catch (err) {
                    Logger.log("❌ Error pada updateCalendarEvent: " + err.toString());
                }
            } else if (eventId) {
                // Hapus event jika tugas dihapus
                try {
                    deleteCalendarEvent(eventId, whatsappNumber);
                } catch (err) {
                    Logger.log("❌ Error pada deleteCalendarEvent: " + err.toString());
                } finally {
                    deleteEventIdData(taskId); // Selalu hapus ID event dari data
                }
            }
        }
    }

    // Handle DONE sheet edits
    if (isDoneSheet && row >= 10 && row <= 40 && col === 2) {
        if (range.getValue() === false) { // If checkbox is unchecked
            moveTaskBackToReminder(row, whatsappNumber);
        }
    }
}

function onEdit(e) {
    // Tidak melakukan apa-apa, hanya sebagai fallback
    Logger.log("Simple trigger onEdit dipanggil, gunakan onEditWithAuth");
}
