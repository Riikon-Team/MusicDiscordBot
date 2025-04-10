import { joinVoiceChannel, createAudioPlayer } from '@discordjs/voice';
import { Innertube } from 'youtubei.js';

/**
 * Tạo và khởi tạo quản lý trình phát nhạc
 * @returns {Object} Player manager
 */
export async function createPlayerManager() {
    // Maps để lưu trữ thông tin
    const connections = new Map(); // Lưu kết nối voice
    const players = new Map();     // Lưu audio player
    const queues = new Map();      // Lưu hàng đợi bài hát
    const currentSongs = new Map(); // Lưu bài hát đang phát
    
    // Khởi tạo YouTube API client với cấu hình nâng cao
    const innertube = await Innertube.create({
        gl: 'VN',
        hl: 'vi',
        generate_session_locally: true, 
    });
    
    return {
        connections,
        players,
        queues,
        currentSongs,
        innertube,
        
        /**
         * Tham gia kênh voice
         * @param {Object} options Thông số kết nối
         * @returns {Object} Connection
         */
        joinVoice(options) {
            const { channelId, guildId, adapterCreator } = options;
            let connection = this.connections.get(guildId);
            
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId,
                    guildId,
                    adapterCreator
                });
                this.connections.set(guildId, connection);
            } else if (connection.joinConfig.channelId !== channelId) {
                // Nếu đã kết nối nhưng khác kênh, kết nối lại
                connection.destroy();
                connection = joinVoiceChannel({
                    channelId,
                    guildId,
                    adapterCreator
                });
                this.connections.set(guildId, connection);
            }
            
            return connection;
        },
        
        /**
         * Tạo audio player mới hoặc lấy player hiện có
         * @param {String} guildId ID của guild
         * @returns {Object} Audio player
         */
        getPlayer(guildId) {
            let player = this.players.get(guildId);
            
            if (!player) {
                player = createAudioPlayer();
                this.players.set(guildId, player);
            }
            
            return player;
        },
        
        /**
         * Thêm bài hát vào hàng đợi
         * @param {String} guildId ID của guild
         * @param {Object} song Thông tin bài hát
         */
        addToQueue(guildId, song) {
            if (!this.queues.has(guildId)) {
                this.queues.set(guildId, []);
            }
            
            this.queues.get(guildId).push(song);
            
            return this.queues.get(guildId).length;
        },
        
        /**
         * Lấy hàng đợi của guild
         * @param {String} guildId ID của guild
         * @returns {Array} Hàng đợi bài hát
         */
        getQueue(guildId) {
            return this.queues.get(guildId) || [];
        },
        
        /**
         * Đặt bài hát hiện tại đang phát
         * @param {String} guildId ID của guild
         * @param {Object} song Thông tin bài hát
         */
        setCurrentSong(guildId, song) {
            this.currentSongs.set(guildId, song);
        },
        
        /**
         * Lấy bài hát hiện tại đang phát
         * @param {String} guildId ID của guild
         * @returns {Object} Thông tin bài hát
         */
        getCurrentSong(guildId) {
            return this.currentSongs.get(guildId);
        },
        
        /**
         * Tìm kiếm video trên YouTube với pagination
         * @param {String} query Từ khóa tìm kiếm
         * @param {Object} options Tùy chọn tìm kiếm
         * @returns {Promise<Object>} Kết quả tìm kiếm với thông tin phân trang
         */
        async searchVideos(query, options = {}) {
            const maxRetries = options.maxRetries || 3;
            let lastError = null;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    // Thực hiện tìm kiếm
                    const results = await this.innertube.search(query, { 
                        type: "video",
                        page: options.page || 1
                    });
                    
                    // Xử lý kết quả tìm kiếm để lấy thông tin cần thiết
                    const videos = results.videos.map(video => ({
                        id: video.id,
                        title: video.title,
                        thumbnail: video.thumbnails?.[0]?.url || 'https://via.placeholder.com/150',
                        duration: video.duration ? formatDuration(video.duration.seconds) : 'N/A',
                        channel: video.channel?.name || 'Không rõ',
                        views: video.view_count ? formatViews(video.view_count) : 'N/A'
                    }));
                    
                    // Trả về dữ liệu đã xử lý và thông tin phân trang
                    return {
                        videos,
                        continuation: results.continuation,
                        totalResults: videos.length,
                        estimatedResults: results.estimated_results || videos.length,
                        currentPage: options.page || 1
                    };
                } catch (err) {
                    console.error(`Lỗi tìm kiếm lần ${attempt + 1}:`, err.message);
                    lastError = err;
                    // Đợi trước khi thử lại (thời gian đợi tăng dần)
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                }
            }
            
            // Nếu tất cả các lần thử đều thất bại
            throw lastError || new Error('Không thể tìm kiếm video');
        },
        
        /**
         * Lấy danh sách kênh voice trong một guild
         * @param {String} guildId ID của guild
         * @param {Client} client Discord client
         * @returns {Array} Danh sách kênh voice
         */
        getVoiceChannels(guildId, client) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return [];
            
            return guild.channels.cache
                .filter(c => c.type === 2)
                .map(c => ({
                    id: c.id,
                    name: c.name,
                    members: c.members.size
                }));
        },
        
        /**
         * Kiểm tra xem bot có đang trong voice channel không
         * @param {String} guildId ID của guild
         * @returns {Boolean} Trạng thái kết nối voice
         */
        isConnected(guildId) {
            return this.connections.has(guildId);
        },
        
        /**
         * Lấy ID kênh voice hiện tại của bot
         * @param {String} guildId ID của guild
         * @returns {String|null} ID kênh voice hoặc null nếu không kết nối
         */
        getCurrentVoiceChannel(guildId) {
            const connection = this.connections.get(guildId);
            return connection ? connection.joinConfig.channelId : null;
        }
    };
}

/**
 * Custom fetch với xử lý lỗi và thử lại
 * @param {RequestInfo|URL} input URL hoặc thông tin yêu cầu
 * @param {RequestInit} init Tùy chọn khởi tạo cho fetch
 * @returns {Promise<Response>} Kết quả phản hồi
 */
async function customFetch(input, init = {}) {
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(input, init);
            if (!response.ok && response.status >= 500) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error(`Fetch error (attempt ${attempt + 1}/${maxRetries}):`, error.message);
            lastError = error;
            // Đợi một thời gian trước khi thử lại (tăng dần)
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
    }
    
    throw lastError || new Error('Fetch failed after multiple attempts');
}

// Hàm định dạng thời lượng
function formatDuration(seconds) {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// Hàm định dạng số lượt xem
function formatViews(viewCount) {
    if (!viewCount) return 'N/A';
    
    if (viewCount >= 1000000) {
        return `${(viewCount / 1000000).toFixed(1)}M`;
    }
    
    if (viewCount >= 1000) {
        return `${(viewCount / 1000).toFixed(1)}K`;
    }
    
    return viewCount.toString();
}