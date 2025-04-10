export default {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Đã đăng nhập với tên ${client.user.tag}`);
        client.user.setActivity('Phát nhạc cùng bạn!', { type: 'LISTENING' });
        client.user.setStatus('online');
    }
}