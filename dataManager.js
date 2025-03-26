function initCalendarDataSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dataSheet = ss.getSheetByName("DATA CALENDAR");

    // Buat sheet baru jika belum ada
    if (!dataSheet) {
        dataSheet = ss.insertSheet("DATA CALENDAR");
        // Setup header
        dataSheet.getRange("A1:C1").setValues([["Task ID", "Event ID", "Status"]]);
        dataSheet.hideSheet(); // Sembunyikan sheet
    }
    return dataSheet;
}

function getEventId(taskId) {
    var dataSheet = initCalendarDataSheet();
    var data = dataSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
        if (data[i][0] === taskId) {
            return data[i][1];
        }
    }
    return null;
}

function saveEventId(taskId, eventId) {
    var dataSheet = initCalendarDataSheet();
    var data = dataSheet.getDataRange().getValues();
    var rowIndex = -1;

    // Cari taskId yang ada atau baris kosong
    for (var i = 1; i < data.length; i++) {
        if (data[i][0] === taskId || !data[i][0]) {
            rowIndex = i + 1;
            break;
        }
    }

    // Jika tidak ditemukan, tambah baris baru
    if (rowIndex === -1) {
        rowIndex = data.length + 1;
    }

    dataSheet.getRange(rowIndex, 1, 1, 2).setValues([[taskId, eventId]]);
}

function deleteEventIdData(taskId) {
    var dataSheet = initCalendarDataSheet();
    var data = dataSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
        if (data[i][0] === taskId) {
            dataSheet.getRange(i + 1, 1, 1, 2).clearContent();
            break;
        }
    }
}
