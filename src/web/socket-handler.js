/**
 * Thiết lập các xử lý Socket.IO
 * @param {Server} io Socket.IO server
 * @param {Client} client Discord client
 */
export function setupSocketHandlers(io, client) {
    io.on('connection', (socket) => {
        console.log('Một người dùng đã kết nối');
        
        // Gửi dữ liệu hiện tại cho client mới kết nối
        socket.on('requestData', (data) => {
            const { guildId } = data;
            if (guildId) {
                const queue = client.cus.getQueue(guildId);
                const currentSong = client.cus.getCurrentSong(guildId);
                
                socket.emit('queueUpdate', { guildId, queue });
                socket.emit('playbackUpdate', { 
                    guildId, 
                    currentSong, 
                    isPlaying: currentSong !== undefined 
                });
            }
        });
        
        socket.on('disconnect', () => {
            console.log('Một người dùng đã ngắt kết nối');
        });
    });
    
    // Đăng ký hàm emit để có thể sử dụng từ nơi khác
    client.cus.emitPlaybackUpdate = (guildId, currentSong, isPlaying) => {
        io.emit('playbackUpdate', { guildId, currentSong, isPlaying });
    };
    
    client.cus.emitQueueUpdate = (guildId, queue) => {
        io.emit('queueUpdate', { guildId, queue });
    };
}