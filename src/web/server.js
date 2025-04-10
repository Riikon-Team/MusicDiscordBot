import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupRoutes } from './routes.js';
import { setupSocketHandlers } from './socket-handler.js';

/**
 * Khởi động web server và cấu hình Socket.IO
 * @param {Client} client Discord client
 * @returns {Server} Socket.IO server
 */
export function startWebServer(client) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const viewsPath = path.join(__dirname, '..', 'views');
    const publicPath = path.join(__dirname, '..', 'public');
    
    // Khởi tạo Express và HTTP server
    const app = express();
    const server = http.createServer(app);
    
    // Khởi tạo Socket.IO
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });
    
    // Cấu hình middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(publicPath));
    
    // Cấu hình view engine
    app.set('view engine', 'ejs');
    app.set('views', viewsPath);
    
    // Thiết lập routes
    setupRoutes(app, client);
    
    // Thiết lập socket handlers
    setupSocketHandlers(io, client);
    
    // Khởi động server
    const PORT = process.env.WEB_PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Web server đang chạy tại port ${PORT}`);
    });
    
    return io;
}