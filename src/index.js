import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import { initializeClient } from './bot/client.js';
import { startWebServer } from './web/server.js';
import ytdlpManager from './utils/ytdlp-manager.js';

// Khởi tạo bot và web server
async function main() {
    try {
        // Khởi tạo yt-dlp
        console.log('Khởi tạo yt-dlp...');
        await ytdlpManager.initialize();
        
        await ytdlpManager.setCookies(fs.readFileSync('./cookies.txt', 'utf-8'));
        console.log('yt-dlp đã được khởi tạo thành công');

        // Khởi tạo Discord client
        const client = await initializeClient();
        
        // Khởi động web server sau khi bot đã sẵn sàng
        const io = startWebServer(client);
        
        console.log('Bot và Web server đã khởi động thành công');
    } catch (error) {
        console.error('Lỗi khi khởi động ứng dụng:', error);
        process.exit(1);
    }
}

main();