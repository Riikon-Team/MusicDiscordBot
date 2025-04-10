import { createAudioResource, AudioPlayerStatus, StreamType } from '@discordjs/voice';
import ytdlpManager from '../utils/ytdlp-manager.js';

/**
 * Phát bài hát tiếp theo trong hàng đợi
 * @param {String} guildId ID của guild
 * @param {Client} client Discord client
 * @param {String} voiceChannelId ID của kênh voice (tùy chọn)
 */
export async function playNextSong(guildId, client, voiceChannelId = null) {
    const { cus } = client;
    const queue = cus.queues.get(guildId);
    
    // Nếu hàng đợi trống, xóa bài hát hiện tại
    if (!queue || queue.length === 0) { 
        cus.currentSongs.delete(guildId);
        if (typeof cus.emitPlaybackUpdate === 'function') {
            cus.emitPlaybackUpdate(guildId, null, false);
        }
        return;
    }
    
    // Lấy bài hát tiếp theo
    const song = queue.shift();
    cus.setCurrentSong(guildId, song);
    
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    
    // Tìm kênh voice
    let voiceChannel;
    
    if (voiceChannelId) {
        // Sử dụng kênh voice được chỉ định
        voiceChannel = guild.channels.cache.get(voiceChannelId);
    } else {
        // Tìm kênh voice đầu tiên hoặc kênh hiện tại nếu đã kết nối
        if (cus.connections.has(guildId)) {
            const connection = cus.connections.get(guildId);
            voiceChannel = guild.channels.cache.get(connection.joinConfig.channelId);
        } else {
            const voiceChannels = guild.channels.cache.filter(c => c.type === 2);
            if (voiceChannels.size === 0) {
                console.log(`Không tìm thấy kênh voice trong server ${guild.name}`);
                // Xóa bài hát hiện tại và chuyển sang bài tiếp theo
                cus.currentSongs.delete(guildId);
                return;
            }
            voiceChannel = voiceChannels.first();
        }
    }
    
    if (!voiceChannel) {
        console.error(`Không thể tìm thấy kênh voice với ID: ${voiceChannelId}`);
        cus.currentSongs.delete(guildId);
        return;
    }
    
    try {
        // Tham gia kênh voice
        const connection = cus.joinVoice({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator
        });
        
        // Lấy hoặc tạo player mới
        const player = cus.getPlayer(guildId);
        connection.subscribe(player);
        
        // Đăng ký sự kiện khi player chuyển trạng thái
        player.removeAllListeners();
        player.on('stateChange', (oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Idle && 
                oldState.status !== AudioPlayerStatus.Idle) {
                // Tự động phát bài tiếp theo
                playNextSong(guildId, client, voiceChannel.id);
            }
        });
        
        // Xử lý lỗi từ player
        player.on('error', (error) => {
            console.error('Lỗi player:', error);
            setTimeout(() => playNextSong(guildId, client, voiceChannel.id), 1000);
        });
        
        // Lấy videoId từ URL
        let videoId;
        if (song.url.includes('youtube.com') || song.url.includes('youtu.be')) {
            try {
                const urlObj = new URL(song.url);
                videoId = urlObj.searchParams.get('v') || 
                          song.url.split('youtu.be/')[1] || 
                          song.url;
                // Loại bỏ các tham số khác nếu có
                if (videoId.includes('&')) {
                    videoId = videoId.split('&')[0];
                }
            } catch (e) {
                videoId = song.url;
            }
        } else {
            videoId = song.url;
        }
        
        // Cập nhật trạng thái bot
        cus.updateBotStatus(client, guildId);
        
        console.log(`Phát bài hát với yt-dlp: ${song.title} (${videoId})`);
        
        // Chuẩn bị các tham số phát nhạc
        const additionalArgs = [
            // Tối ưu hóa cho streaming nhanh
            '--force-ipv4',
            '--no-check-certificate',
            '--prefer-insecure',
            '--geo-bypass',
            '--audio-quality', '0', // Chất lượng âm thanh cao nhất
            '--buffer-size', '16K', // Buffer nhỏ để bắt đầu phát nhanh hơn
        ];
        
        // Nếu có vị trí seek, thêm tham số
        if (song.seekPosition) {
            additionalArgs.push('--start-time', `${song.seekPosition}`);
            console.log(`Đang seek đến vị trí ${song.seekPosition}s`);
        }
        
        try {
            // Lấy stream audio từ yt-dlp với các tham số tối ưu
            const audioStream = await ytdlpManager.streamAudio(videoId, {
                additionalArgs
            });
            
            // Tạo resource và phát
            const resource = createAudioResource(audioStream, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true
            });
            
            // Thiết lập âm lượng
            if (resource.volume) {
                resource.volume.setVolume(1.0);
            }
            
            player.play(resource);
            
            console.log(`Đang phát bài hát: ${song.title}`);
            
            // Thông báo qua socket.io
            if (typeof cus.emitPlaybackUpdate === 'function') {
                cus.emitPlaybackUpdate(guildId, song, true, {
                    seekPosition: song.seekPosition || 0
                });
                cus.emitQueueUpdate(guildId, cus.getQueue(guildId));
            }
        } catch (error) {
            console.error('Lỗi khi phát nhạc với yt-dlp:', error);
            
            // Nếu tất cả đều thất bại, chuyển sang bài tiếp theo
            console.error(`Không thể phát bài ${song.title}. Đang chuyển sang bài tiếp theo...`);
            cus.currentSongs.delete(guildId);
            setTimeout(() => playNextSong(guildId, client, voiceChannel.id), 1000);
        }
        
    } catch (error) {
        console.error('Lỗi khi phát nhạc:', error);
        cus.currentSongs.delete(guildId);
        setTimeout(() => playNextSong(guildId, client, voiceChannel.id), 1000);
    }
}