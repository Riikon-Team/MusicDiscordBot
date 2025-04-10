export default {
    name: 'stop',
    description: 'Dừng phát nhạc và xóa hàng đợi',
    async execute(message) {
        if (!message.member.voice.channel) {
            return message.reply('Bạn cần vào một kênh voice để sử dụng lệnh này!');
        }
        
        const guildId = message.guild.id;
        const { cus } = message.client;
        const { connections, players, queues, currentSongs } = cus;
        
        if (!currentSongs.has(guildId)) {
            return message.reply('Không có bài hát nào đang phát!');
        }
        
        // Xóa hàng đợi
        queues.set(guildId, []);
        
        // Dừng phát nhạc
        if (players.has(guildId)) {
            players.get(guildId).stop();
        }
        
        // Ngắt kết nối
        if (connections.has(guildId)) {
            connections.get(guildId).destroy();
            connections.delete(guildId);
        }
        
        // Xóa thông tin bài hát hiện tại
        currentSongs.delete(guildId);
        
        await message.channel.send('⏹️ Đã dừng phát nhạc và xóa hàng đợi!');
    }
};