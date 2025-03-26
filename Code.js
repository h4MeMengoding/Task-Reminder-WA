function doPost(e) {
    var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
    var noWhatsApp = sheetSetup.getRange("C3").getValue();
    var tokenFonnte = sheetSetup.getRange("C4").getValue();

    try {
        var requestData = JSON.parse(e.postData.contents);
        var sender = requestData.sender;
        var message = requestData.message;

        Logger.log("Pesan diterima dari: " + sender);
        Logger.log("Pesan: " + message);

        if (sender === noWhatsApp) {
            var trimmedMessage = message.trim().toLowerCase();

            if (trimmedMessage === "!calendar") {
                return handleResponse(handleCalendarCommand(sender, tokenFonnte));
            }

            if (trimmedMessage === "!api") {
                return handleResponse(handleApiCommand(sender, tokenFonnte));
            }

            if (trimmedMessage === "!help") {
                return handleResponse(handleHelpCommand(sender, tokenFonnte));
            }

            if (trimmedMessage === "!done") {
                return handleResponse(handleDoneCommand(sender, tokenFonnte));
            }

            if (trimmedMessage === "!todo") {
                return handleResponse(handleTodoCommand(sender, tokenFonnte));
            }

            if (trimmedMessage.startsWith("!add")) {
                return handleResponse(handleAddCommand(sender, message));
            }

            if (trimmedMessage.startsWith("!del")) {
                return handleResponse(handleDelCommand(sender, message));
            }

            if (trimmedMessage.startsWith("!selesai")) {
                return handleResponse(handleSelesaiCommand(sender, message));
            }
        }

        return handleResponse(true);

    } catch (error) {
        Logger.log("Error in doPost: " + error.toString());
        return handleResponse(false, error.toString());
    }
}

function handleResponse(success, message) {
    return ContentService.createTextOutput(JSON.stringify({
        status: success ? 'success' : 'error',
        message: message || ''
    })).setMimeType(ContentService.MimeType.JSON);
}
