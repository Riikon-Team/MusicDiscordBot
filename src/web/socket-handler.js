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
                const playbackState = client.cus.getPlaybackState(guildId);
                
                socket.emit('queueUpdate', { guildId, queue });
                socket.emit('playbackUpdate', { 
                    guildId,
                    ...playbackState
                });
            }
        });
        
        // Xử lý lệnh pause
        socket.on('pausePlayback', (data) => {
            const { guildId } = data;
            if (guildId) {
                client.cus.pausePlayback(guildId);
            }
        });
        
        // Xử lý lệnh resume
        socket.on('resumePlayback', (data) => {
            const { guildId } = data;
            if (guildId) {
                client.cus.resumePlayback(guildId);
            }
        });
        
        // Xử lý lệnh seek
        socket.on('seekToPosition', (data) => {
            const { guildId, position } = data;
            if (guildId && position !== undefined) {
                client.cus.seekToPosition(guildId, position);
            }
        });
        
        socket.on('disconnect', () => {
            console.log('Một người dùng đã ngắt kết nối');
        });
    });
    
    // Đăng ký hàm emit để có thể sử dụng từ nơi khác
    client.cus.emitPlaybackUpdate = (guildId, currentSong, isPlaying, additionalInfo = {}) => {
        io.emit('playbackUpdate', { 
            guildId, 
            currentSong, 
            isPlaying,
            isPaused: additionalInfo.isPaused || false,
            seekPosition: additionalInfo.seekPosition || 0
        });
    };
    
    client.cus.emitQueueUpdate = (guildId, queue) => {
        io.emit('queueUpdate', { guildId, queue });
    };
}