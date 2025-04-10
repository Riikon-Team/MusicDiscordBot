// Kết nối Socket.IO
const socket = io();

// Cập nhật giao diện khi có thay đổi về bài hát đang phát
socket.on('playbackUpdate', (data) => {
    if (data.guildId === guildId) {
        updateCurrentSong(data.currentSong, data.isPlaying);
    }
});

// Cập nhật giao diện khi có thay đổi về hàng đợi
socket.on('queueUpdate', (data) => {
    if (data.guildId === guildId) {
        updateQueueList(data.queue);
    }
});

// Cập nhật hiển thị bài hát hiện tại
function updateCurrentSong(song, isPlaying) {
    const playerContainer = document.getElementById('player-container');
    
    if (!song) {
        playerContainer.innerHTML = `
            <div class="text-center p-5">
                <h5>Không có bài hát nào đang phát</h5>
                <p>Thêm một bài hát để bắt đầu phát nhạc</p>
            </div>
        `;
        return;
    }
    
    playerContainer.innerHTML = `
        <div class="current-song-info">
            <div class="row">
                <div class="col-md-4">
                    <img src="${song.thumbnail}" class="img-fluid rounded" alt="${song.title}">
                </div>
                <div class="col-md-8">
                    <h5 id="current-song-title">${song.title}</h5>
                    <div class="duration">
                        <span class="badge bg-secondary">${song.duration || 'N/A'}</span>
                    </div>
                    <div class="mt-3">
                        <button id="skip-button" class="btn btn-warning" onclick="skipSong()">
                            <i class="fas fa-forward"></i> Bỏ qua
                        </button>
                        <button id="stop-button" class="btn btn-danger" onclick="stopPlayback()">
                            <i class="fas fa-stop"></i> Dừng lại
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Cập nhật danh sách phát
function updateQueueList(queue) {
    const queueList = document.getElementById('queue-list');
    
    if (!queue || queue.length === 0) {
        queueList.innerHTML = '<li class="list-group-item text-center">Danh sách phát trống</li>';
        return;
    }
    
    queueList.innerHTML = queue.map((song, index) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            <div>
                <span class="badge bg-primary me-2">${index + 1}</span>
                ${song.title}
            </div>
            <span class="badge bg-secondary">${song.duration || 'N/A'}</span>
        </li>
    `).join('');
}

// Xử lý form tìm kiếm
document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;
    
    try {
        const response = await fetch('/api/play', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ guildId, query })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
        } else {
            document.getElementById('search-input').value = '';
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Đã xảy ra lỗi khi thêm bài hát');
    }
});

// Bỏ qua bài hát
async function skipSong() {
    try {
        await fetch('/api/skip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ guildId })
        });
    } catch (error) {
        console.error('Error:', error);
        alert('Đã xảy ra lỗi khi bỏ qua bài hát');
    }
}

// Dừng phát nhạc
async function stopPlayback() {
    try {
        await fetch('/api/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ guildId })
        });
    } catch (error) {
        console.error('Error:', error);
        alert('Đã xảy ra lỗi khi dừng phát nhạc');
    }
}