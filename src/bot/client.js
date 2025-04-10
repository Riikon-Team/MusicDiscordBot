import { Client, GatewayIntentBits } from 'discord.js';
import { createPlayerManager } from '../music/player-manager.js';
import { loadEvents } from './event-loader.js';

/**
 * Khởi tạo Discord client với các intent cần thiết
 * @returns {Promise<Client>} Discord client đã được khởi tạo
 */
export async function initializeClient() {
    // Khởi tạo Discord client
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessageTyping,
            GatewayIntentBits.GuildMessageReactions,
        ],
    });

    // Khởi tạo player manager và gán vào client
    // Thêm await ở đây để đảm bảo playerManager đã được giải quyết
    const playerManager = await createPlayerManager();
    client.cus = playerManager;
    
    // Tải các sự kiện
    await loadEvents(client);
    
    // Đăng nhập bot
    await client.login(process.env.TOKEN);
    console.log(`Đã đăng nhập với bot ${client.user.tag}`);
    
    return client;
}