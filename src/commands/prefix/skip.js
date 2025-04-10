export default {
    name: 'skip',
    description: 'Bỏ qua bài hát hiện tại',
    async execute(message) {
        if (!message.member.voice.channel) {
            return message.reply('Bạn cần vào một kênh voice để sử dụng lệnh này!');
        }
        
        const guildId = message.guild.id;
        const { cus } = message.client;
        const { players, currentSongs } = cus;
        
        if (!currentSongs.has(guildId)) {
            return message.reply('Không có bài hát nào đang phát!');
        }
        
        if (players.has(guildId)) {
            players.get(guildId).stop();
            await message.channel.send('⏭️ Đã bỏ qua bài hát hiện tại!');
        }
    }
};