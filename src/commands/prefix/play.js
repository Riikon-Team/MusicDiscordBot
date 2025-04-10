import { joinVoiceChannel, createAudioResource } from '@discordjs/voice';
import Innertube from 'youtubei.js';

const innertube = await Innertube.create();

export default {
    name: 'play',
    description: 'Phát nhạc từ YouTube',
    async execute(message, args) {
        // Kiểm tra nếu người dùng không trong voice channel
        if (!message.member.voice.channel) {
            return message.reply('Bạn cần vào một kênh voice để sử dụng lệnh này!');
        }

        // Kiểm tra nếu không có tham số tìm kiếm
        if (!args.length) {
            return message.reply('Vui lòng nhập tên bài hát hoặc URL YouTube!');
        }

        const query = args.join(' ');
        const guildId = message.guild.id;

        try {
            const loadingMsg = await message.channel.send('🔎 Đang tìm kiếm...');

            // Tìm kiếm video trên YouTube
            const search = await innertube.search(query, { type: 'video' });
            if (!search.videos.length) {
                await loadingMsg.edit('❌ Không tìm thấy video nào khớp với yêu cầu của bạn!');
                return;
            }

            const video = search.videos[0];

            // Lấy thông tin client từ index.js
            const { cus } = message.client;
            const { connections, players, queues, currentSongs } = cus;

            // Khởi tạo hàng đợi nếu chưa tồn tại
            if (!queues.has(guildId)) {
                queues.set(guildId, []);
            }

            // Thêm bài hát vào hàng đợi
            const songInfo = {
                title: video.title,
                url: `https://www.youtube.com/watch?v=${video.id}`,
                thumbnail: video.thumbnails[0].url,
                duration: video.duration ? formatDuration(video.duration.seconds) : 'N/A',
                requestedBy: message.author.tag
            };

            queues.get(guildId).push(songInfo);

            await loadingMsg.edit(`✅ **${video.title}** đã được thêm vào hàng đợi!`);

            // Nếu không có bài hát nào đang phát, phát bài hát đầu tiên trong hàng đợi
            if (!currentSongs.has(guildId)) {
                playNextSong(message);
            }
        } catch (error) {
            console.error('Error in play command:', error);
            await message.channel.send('❌ Đã xảy ra lỗi khi xử lý yêu cầu của bạn!');
        }
    }
};

// Hàm phát bài hát tiếp theo
async function playNextSong(message) {
    const guildId = message.guild.id;
    const { cus } = message.client;
    const { connections, players, queues, currentSongs } = cus;

    const queue = queues.get(guildId);

    // Nếu hàng đợi trống, xóa thông tin bài hát hiện tại
    if (!queue || queue.length === 0) {
        currentSongs.delete(guildId);
        return;
    }

    // Lấy bài hát đầu tiên từ hàng đợi
    const song = queue.shift();
    currentSongs.set(guildId, song);

    // Tham gia kênh voice nếu chưa kết nối
    if (!connections.has(guildId)) {
        const connection = joinVoiceChannel({
            channelId: message.member.voice.channel.id,
            guildId: guildId,
            adapterCreator: message.guild.voiceAdapterCreator
        });
        connections.set(guildId, connection);
    }

    // Tạo player mới nếu chưa tồn tại
    if (!players.has(guildId)) {
        const player = createAudioPlayer();
        players.set(guildId, player);

        const connection = connections.get(guildId);
        connection.subscribe(player);

        player.on('stateChange', (oldState, newState) => {
            if (newState.status === 'idle' && oldState.status !== 'idle') {
                playNextSong(message);
            }
        });
    }

    // Phát bài hát sử dụng yt-dlp
    try {
        console.log(`Phát bài hát với yt-dlp: ${song.title} (${videoId})`);

        // Phương pháp 1: Thử lấy URL trực tiếp trước
        try {
            const directUrl = await ytdlpManager.getDirectAudioUrl(videoId);
            console.log(`Đã nhận được URL âm thanh trực tiếp, đang phát...`);

            const resource = createAudioResource(directUrl);
            player.play(resource);

            console.log(`Đang phát bài hát: ${song.title}`);

            // Thông báo qua socket.io
            if (typeof cus.emitPlaybackUpdate === 'function') {
                cus.emitPlaybackUpdate(guildId, song, true);
                cus.emitQueueUpdate(guildId, cus.getQueue(guildId));
            }
            return;
        } catch (directUrlError) {
            console.error('Không thể lấy URL trực tiếp, đang thử phương pháp streaming:', directUrlError);
            // Tiếp tục với phương pháp streaming nếu lấy URL trực tiếp thất bại
        }

        // Phương pháp 2: Sử dụng stream từ yt-dlp
        const audioStream = await ytdlpManager.streamAudio(videoId, {
            additionalArgs: [
                // Chọn audio chất lượng cao
                '--audio-quality', '0',
            ]
        });

        // Tạo resource và phát
        const resource = createAudioResource(audioStream, {
            inputType: StreamType.Arbitrary // Thêm kiểu dữ liệu stream
        });

        player.play(resource);

        console.log(`Đang phát bài hát: ${song.title}`);

        // Thông báo qua socket.io
        if (typeof cus.emitPlaybackUpdate === 'function') {
            cus.emitPlaybackUpdate(guildId, song, true);
            cus.emitQueueUpdate(guildId, cus.getQueue(guildId));
        }
    } catch (error) {
        console.error('Lỗi khi phát nhạc với yt-dlp:', error);

        // Thử phương pháp dự phòng nếu yt-dlp thất bại
        console.log('Chuyển sang phương pháp dự phòng...');

        // [Giữ mã dự phòng sử dụng youtubei.js ở đây]
        // ... (các phương pháp dự phòng hiện tại)

        // Nếu tất cả đều thất bại, chuyển sang bài tiếp theo
        console.error(`Không thể phát bài ${song.title}. Đang chuyển sang bài tiếp theo...`);
        cus.currentSongs.delete(guildId);
        await setTimeout(1000);
        playNextSong(guildId, client, voiceChannel.id);
    }
}

// Hàm định dạng thời gian
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}