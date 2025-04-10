import { playNextSong } from '../music/queue-manager.js';

/**
 * Thiết lập routes cho web server
 * @param {Express} app Express app
 * @param {Client} client Discord client
 */
export function setupRoutes(app, client) {
    // Trang chủ - hiển thị danh sách server
    app.get('/', (req, res) => {
        try {
            // Kiểm tra xem client.cus đã sẵn sàng chưa
            if (!client.cus || typeof client.cus.getCurrentSong !== 'function') {
                console.error('client.cus hoặc client.cus.getCurrentSong không khả dụng');
                return res.render('index', { guilds: [], error: 'Bot đang khởi động, vui lòng thử lại sau.' });
            }

            // Lấy danh sách server mà bot đang tham gia
            const guilds = client.guilds.cache.map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: guild.iconURL() || 'https://via.placeholder.com/150',
                currentSong: client.cus.getCurrentSong(guild.id)
            }));

            res.render('index', { guilds, error: null });
        } catch (error) {
            console.error('Lỗi khi hiển thị trang chủ:', error);
            res.render('index', { guilds: [], error: 'Đã xảy ra lỗi khi tải dữ liệu.' });
        }
    });

    // Dashboard của server
    app.get('/dashboard/:guildId', (req, res) => {
        try {
            const { guildId } = req.params;
            const guild = client.guilds.cache.get(guildId);
            
            if (!guild) {
                return res.redirect('/');
            }
            
            // Kiểm tra xem client.cus đã sẵn sàng chưa
            if (!client.cus || typeof client.cus.getQueue !== 'function') {
                return res.render('dashboard', { 
                    guild, 
                    queue: [], 
                    currentSong: null,
                    voiceChannels: [],
                    currentVoiceChannel: null,
                    error: 'Bot đang khởi động, vui lòng thử lại sau.'
                });
            }
            
            const queue = client.cus.getQueue(guildId);
            const currentSong = client.cus.getCurrentSong(guildId);
            
            // Lấy danh sách kênh voice
            const voiceChannels = client.cus.getVoiceChannels(guildId, client);
            const currentVoiceChannel = client.cus.getCurrentVoiceChannel(guildId);
            
            res.render('dashboard', { 
                guild, 
                queue, 
                currentSong, 
                voiceChannels,
                currentVoiceChannel,
                error: null 
            });
        } catch (error) {
            console.error('Lỗi khi hiển thị dashboard:', error);
            res.redirect('/');
        }
    });

    // API - Tìm kiếm video - Đã cập nhật để xử lý cấu trúc dữ liệu mới
    app.get('/api/search', async (req, res) => {
        try {
            const { query, page = 1 } = req.query;
            
            if (!query) {
                return res.status(400).json({ error: 'Vui lòng nhập từ khóa tìm kiếm' });
            }
            
            // Kiểm tra client.cus
            if (!client.cus || !client.cus.innertube) {
                return res.status(500).json({ 
                    error: 'Bot đang khởi động, vui lòng thử lại sau',
                    videos: [],
                    pagination: { currentPage: 1, totalPages: 1 }
                });
            }
            
            console.log(`Đang tìm kiếm: "${query}" (trang ${page})`);
            
            // Tìm kiếm video
            const searchResults = await client.cus.searchVideos(query, { 
                page: parseInt(page),
                maxRetries: 3
            });
            
            // Trả về kết quả tìm kiếm với thông tin phân trang
            res.json({
                videos: searchResults.videos || [],
                pagination: {
                    currentPage: searchResults.currentPage || 1,
                    totalPages: Math.ceil(searchResults.estimatedResults / 10) || 1,
                    hasMore: !!searchResults.continuation
                }
            });
        } catch (error) {
            console.error('Lỗi khi tìm kiếm video:', error);
            res.status(500).json({ 
                error: 'Đã xảy ra lỗi khi tìm kiếm. Vui lòng thử lại sau.',
                videos: [],
                pagination: { currentPage: 1, totalPages: 1 } 
            });
        }
    });

    // API - Phát nhạc
    app.post('/api/play', async (req, res) => {
        try {
            const { guildId, videoId, title, thumbnail, duration, voiceChannelId } = req.body;

            // Kiểm tra các dữ liệu cần thiết
            if (!client.cus) {
                return res.status(500).json({ error: 'Bot đang khởi động, vui lòng thử lại sau' });
            }
            
            if (!guildId || !videoId) {
                return res.status(400).json({ error: 'Thiếu thông tin bài hát hoặc server' });
            }
            
            // Nếu không có kênh voice được chỉ định, kiểm tra xem bot đã kết nối chưa
            if (!voiceChannelId && !client.cus.isConnected(guildId)) {
                return res.status(400).json({ 
                    error: 'Bot không có mặt trong kênh voice nào. Vui lòng chọn một kênh voice để kết nối.',
                    needVoiceChannel: true,
                    voiceChannels: client.cus.getVoiceChannels(guildId, client)
                });
            }

            // Thêm vào hàng đợi
            const songInfo = {
                title: title || 'Không rõ tiêu đề',
                url: `https://www.youtube.com/watch?v=${videoId}`,
                thumbnail: thumbnail || 'https://via.placeholder.com/150',
                duration: duration || 'N/A',
                addedAt: new Date().toISOString()
            };

            client.cus.addToQueue(guildId, songInfo);
            console.log(`Đã thêm "${songInfo.title}" vào hàng đợi`);

            // Phát nếu chưa phát
            if (!client.cus.getCurrentSong(guildId)) {
                await playNextSong(guildId, client, voiceChannelId);
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Lỗi khi xử lý yêu cầu phát nhạc:', error);
            res.status(500).json({ error: 'Đã xảy ra lỗi khi phát nhạc. Vui lòng thử lại sau.' });
        }
    });
    

    // API - Bỏ qua bài hát
    app.post('/api/skip', (req, res) => {
        try {
            const { guildId } = req.body;
            
            if (!client.cus) {
                return res.status(500).json({ error: 'Bot đang khởi động, vui lòng thử lại sau' });
            }
            
            if (client.cus.players.has(guildId)) {
                client.cus.players.get(guildId).stop();
            }
            
            res.json({ success: true });
        } catch (error) {
            console.error('Lỗi khi bỏ qua bài hát:', error);
            res.status(500).json({ error: 'Lỗi khi bỏ qua bài hát' });
        }
    });

    // API - Dừng phát nhạc
    app.post('/api/stop', (req, res) => {
        try {
            const { guildId } = req.body;
            
            if (!client.cus) {
                return res.status(500).json({ error: 'Bot đang khởi động, vui lòng thử lại sau' });
            }
            
            // Xóa hàng đợi
            client.cus.queues.set(guildId, []);
            
            // Dừng phát nhạc
            if (client.cus.players.has(guildId)) {
                client.cus.players.get(guildId).stop();
            }
            
            // Ngắt kết nối
            if (client.cus.connections.has(guildId)) {
                client.cus.connections.get(guildId).destroy();
                client.cus.connections.delete(guildId);
            }
            
            client.cus.currentSongs.delete(guildId);
            
            res.json({ success: true });
        } catch (error) {
            console.error('Lỗi khi dừng phát nhạc:', error);
            res.status(500).json({ error: 'Lỗi khi dừng phát nhạc' });
        }
    });

    // API - Kết nối kênh voice
    app.post('/api/join', (req, res) => {
        try {
            const { guildId, voiceChannelId } = req.body;
            
            if (!client.cus) {
                return res.status(500).json({ error: 'Bot đang khởi động, vui lòng thử lại sau' });
            }
            
            if (!guildId || !voiceChannelId) {
                return res.status(400).json({ error: 'Thiếu thông tin server hoặc kênh voice' });
            }
            
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Không tìm thấy server' });
            }
            
            const voiceChannel = guild.channels.cache.get(voiceChannelId);
            if (!voiceChannel || voiceChannel.type !== 2) {
                return res.status(404).json({ error: 'Không tìm thấy kênh voice' });
            }
            
            // Kết nối kênh voice
            const connection = client.cus.joinVoice({
                channelId: voiceChannelId,
                guildId: guildId,
                adapterCreator: guild.voiceAdapterCreator
            });
            
            res.json({ 
                success: true,
                message: `Đã kết nối với kênh voice: ${voiceChannel.name}`
            });
        } catch (error) {
            console.error('Lỗi khi kết nối kênh voice:', error);
            res.status(500).json({ error: 'Lỗi khi kết nối kênh voice' });
        }
    });

    // API - Tạm dừng phát nhạc
    app.post('/api/pause', (req, res) => {
        try {
            const { guildId } = req.body;
            
            if (!client.cus) {
                return res.status(500).json({ error: 'Bot đang khởi động, vui lòng thử lại sau' });
            }
            
            const success = client.cus.pausePlayback(guildId);
            
            if (success) {
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Không thể tạm dừng phát nhạc' });
            }
        } catch (error) {
            console.error('Lỗi khi tạm dừng phát nhạc:', error);
            res.status(500).json({ error: 'Lỗi khi tạm dừng phát nhạc' });
        }
    });
    
    // API - Tiếp tục phát nhạc
    app.post('/api/resume', (req, res) => {
        try {
            const { guildId } = req.body;
            
            if (!client.cus) {
                return res.status(500).json({ error: 'Bot đang khởi động, vui lòng thử lại sau' });
            }
            
            const success = client.cus.resumePlayback(guildId);
            
            if (success) {
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Không thể tiếp tục phát nhạc' });
            }
        } catch (error) {
            console.error('Lỗi khi tiếp tục phát nhạc:', error);
            res.status(500).json({ error: 'Lỗi khi tiếp tục phát nhạc' });
        }
    });
    
    // API - Seek đến vị trí
    app.post('/api/seek', async (req, res) => {
        try {
            const { guildId, position } = req.body;
            
            if (!client.cus) {
                return res.status(500).json({ error: 'Bot đang khởi động, vui lòng thử lại sau' });
            }
            
            if (!guildId || position === undefined) {
                return res.status(400).json({ error: 'Thiếu thông tin cần thiết' });
            }
            
            const success = await client.cus.seekToPosition(guildId, parseInt(position, 10));
            
            if (success) {
                // Phát lại bài hát từ vị trí mới
                await playNextSong(guildId, client);
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Không thể seek đến vị trí đã chọn' });
            }
        } catch (error) {
            console.error('Lỗi khi seek:', error);
            res.status(500).json({ error: 'Lỗi khi seek' });
        }
    });
}

// Hàm định dạng thời gian
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}