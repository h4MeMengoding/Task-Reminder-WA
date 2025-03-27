function doPost(e) {
    var sheetSetup = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SETUP");
    var tokenFonnte = sheetSetup.getRange("C4").getValue();
    var adminNumber = sheetSetup.getRange("C3").getValue().toString().trim();

    try {
        var requestData = JSON.parse(e.postData.contents);
        var sender = requestData.sender.toString().trim();
        var message = requestData.message;

        Logger.log("Pesan diterima dari: " + sender);
        Logger.log("Pesan: " + message);
        Logger.log("Admin number: " + adminNumber);
        Logger.log("Cocok dengan admin? " + (sender === adminNumber ? "Ya" : "Tidak"));

        // Cek apakah pesan dimulai dengan simbol ! (command)
        var isCommand = message.trim().startsWith("!");
        
        // Jika bukan command, abaikan saja (tidak perlu membalas)
        if (!isCommand) {
            Logger.log("Bukan command, abaikan pesan");
            return handleResponse(true);
        }
        
        // Deteksi apakah pengirim adalah admin
        var isAdmin = (sender === adminNumber);
        Logger.log("Pengirim adalah admin? " + (isAdmin ? "Ya" : "Tidak"));
        
        // Cek apakah pengguna sudah terdaftar secara eksplisit
        var user = getUser(sender);
        var isRegisteredUser = !!user;
        
        Logger.log("Pengguna terdaftar? " + (isRegisteredUser ? "Ya" : "Tidak"));
        
        // Debugging: kirim pesan debug ke admin jika ada masalah pengenalan admin
        if (sender === adminNumber && !isRegisteredUser) {
            Logger.log("KRITICAL ERROR: Admin tidak dikenali sebagai user terdaftar!");
            forceRegisterAdmin();
        }
        
        // Jika pengguna belum terdaftar dan bukan admin dan mencoba menggunakan command
        if (!isRegisteredUser && !isAdmin && isCommand) {
            // Hanya kirim pesan penolakan untuk command, bukan chat biasa
            if (message.toLowerCase().startsWith("!bantuan") || message.toLowerCase().startsWith("!help")) {
                // Izinkan command bantuan/help meskipun belum terdaftar
                return handleResponse(handleHelpCommand(sender, tokenFonnte));
            } else {
                sendFeedback(sender, "Maaf, nomor kamu belum terdaftar. Silakan hubungi admin untuk mendaftar.");
                return handleResponse(true);
            }
        }

        var trimmedMessage = message.trim().toLowerCase();

        if (trimmedMessage === "!calendar") {
            return handleResponse(handleCalendarCommand(sender, tokenFonnte));
        }

        if (trimmedMessage === "!api") {
            return handleResponse(handleApiCommand(sender, tokenFonnte));
        }

        if (trimmedMessage === "!help" || trimmedMessage === "!bantuan") {
            return handleResponse(handleHelpCommand(sender, tokenFonnte));
        }

        if (trimmedMessage === "!done") {
            return handleResponse(handleDoneCommand(sender, tokenFonnte));
        }

        if (trimmedMessage === "!todo") {
            return handleResponse(handleTodoCommand(sender, tokenFonnte));
        }
        
        if (trimmedMessage === "!sync") {
            return handleResponse(handleFixCalendarCommand(sender, tokenFonnte));
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
        
        // Command khusus admin
        if (trimmedMessage.startsWith("!user")) {
            return handleResponse(handleUserCommand(sender, message));
        }

        // Jika ada command yang tidak dikenali (tapi diawali !)
        if (isCommand) {
            sendFeedback(sender, "Perintah tidak dikenali. Gunakan *!help* untuk melihat daftar perintah.");
        }

        return handleResponse(true);

    } catch (error) {
        Logger.log("Error in doPost: " + error.toString());
        return handleResponse(false, error.toString());
    }
}

/**
 * Fungsi untuk memastikan admin selalu terdaftar
 */
function forceRegisterAdmin() {
    Logger.log("🚨 Menjalankan proses registrasi paksa untuk admin...");
    
    try {
        var result = verifyAdminUser();
        Logger.log("✅ Admin berhasil didaftarkan: " + result);
    } catch (e) {
        Logger.log("❌ Gagal mendaftarkan admin: " + e.toString());
    }
}

function handleResponse(success, message) {
    return ContentService.createTextOutput(JSON.stringify({
        status: success ? 'success' : 'error',
        message: message || ''
    })).setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  createCustomMenu();
}
