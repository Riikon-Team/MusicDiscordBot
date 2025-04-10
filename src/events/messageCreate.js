import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const PREFIX_DEFAULT = 'k!';
const commands = new Map();

// Lấy đường dẫn thư mục hiện tại
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsPath = path.join(__dirname, '..', 'commands', 'prefix');

// Tải commands một lần khi module được load
async function loadCommands() {
    try {
        const files = await fs.readdir(commandsPath);
        const commandFiles = files.filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const { default: command } = await import(`../commands/prefix/${file}`);
            commands.set(command.name, command);
            console.log(`Đã tải lệnh prefix: ${command.name}`);
        }
    } catch (err) {
        console.error('Lỗi khi tải prefix commands:', err);
    }
}

// Tải commands ngay lập tức
loadCommands();

export default {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;
        console.log(`Nhận được tin nhắn: ${message.content}`);

        // Kiểm tra xem tin nhắn có bắt đầu bằng prefix không
        if (message.content.startsWith(PREFIX_DEFAULT)) {
            const args = message.content.slice(PREFIX_DEFAULT.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            if (commands.has(commandName)) {
                try {
                    await commands.get(commandName).execute(message, args);
                } catch (error) {
                    console.error(`Lỗi khi thực thi lệnh ${commandName}:`, error);
                    await message.reply('Đã xảy ra lỗi khi thực thi lệnh!');
                }
            }
        }
    }
};