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

    // Handle REMINDER sheet edits
    if (sheet.getName() === "REMINDER" && row >= 10 && row <= 40) {
        if (col === 2) { // Checkbox column
            if (range.getValue() === true) {
                moveCompletedTasks(); // Langsung panggil moveCompletedTasks tanpa pengecekan
                return;
            }
        } else if (col === 6) { // Kolom F - Delete checkbox
            if (range.getValue() === true) {
                var ui = SpreadsheetApp.getUi();
                var response = ui.alert(
                    'Konfirmasi',
                    'Yakin ingin menghapus tugas ini?',
                    ui.ButtonSet.YES_NO
                );

                if (response == ui.Button.YES) {
                    deleteTask(row);
                    range.setValue(false); // Reset checkbox
                } else {
                    range.setValue(false); // Reset checkbox jika user memilih No
                }
            }
        } else if (col === 3 || col === 4) { // Deadline or task name column
            var deadline = sheet.getRange(row, 3).getValue();
            var task = sheet.getRange(row, 4).getValue();
            var taskId = "TASK_" + row; // ID unik untuk setiap tugas
            var eventId = getEventId(taskId); // Dapatkan Event ID dari sheet DATA CALENDAR

            // Update atau buat event calendar jika ada deadline dan nama tugas
            if (deadline && task) {
                updateCalendarEvent(row, deadline, task, eventId);
                sortTasksByDeadline();
            } else if (eventId) {
                // Hapus event jika tugas dihapus
                deleteCalendarEvent(eventId);
                deleteEventIdData(taskId); // Hapus Event ID dari sheet DATA CALENDAR
            }
        }
    }

    // Handle DONE sheet edits
    if (sheet.getName() === "DONE" && row >= 10 && row <= 40 && col === 2) {
        if (range.getValue() === false) { // If checkbox is unchecked
            moveTaskBackToReminder(row);
        }
    }
}

function onEdit(e) {
    // Tidak melakukan apa-apa, hanya sebagai fallback
    Logger.log("Simple trigger onEdit dipanggil, gunakan onEditWithAuth");
}
