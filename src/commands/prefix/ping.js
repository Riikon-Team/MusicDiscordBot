
export default {
    name: 'ping',
    description: 'Ping!',
    async execute(message) {
        await message.reply('Pong!');
    },
};