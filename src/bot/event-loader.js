import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Tải tất cả các sự kiện từ thư mục events
 * @param {Client} client Discord client
 * @returns {Promise<void>}
 */
export async function loadEvents(client) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const eventsDir = path.join(__dirname, '..', 'events');
    
    try {
        const eventFiles = await fs.readdir(eventsDir);
        for (const file of eventFiles) {
            if (file.endsWith('.js')) {
                const { default: event } = await import(`../events/${file}`);
                
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args));
                } else {
                    client.on(event.name, (...args) => event.execute(...args));
                }
                
                console.log(`Đã tải event: ${event.name}`);
            }
        }
    } catch (err) {
        console.error('Lỗi khi tải events:', err);
        throw err;
    }
}