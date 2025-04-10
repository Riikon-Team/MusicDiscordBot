import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Lấy đường dẫn tuyệt đối từ đường dẫn tương đối
 * @param {String} relativePath Đường dẫn tương đối
 * @returns {String} Đường dẫn tuyệt đối
 */
export function getPath(...paths) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.join(__dirname, '..', ...paths);
}

/**
 * Đọc tất cả các file trong thư mục với điều kiện lọc
 * @param {String} dirPath Đường dẫn thư mục
 * @param {Function} filterFn Hàm lọc
 * @returns {Promise<Array>} Danh sách file
 */
export async function readFilesInDir(dirPath, filterFn = () => true) {
    try {
        const files = await fs.readdir(dirPath);
        return files.filter(filterFn);
    } catch (error) {
        console.error(`Lỗi khi đọc thư mục ${dirPath}:`, error);
        return [];
    }
}

/**
 * Tạo thư mục nếu nó chưa tồn tại
 * @param {String} dirPath Đường dẫn thư mục
 * @returns {Promise<Boolean>} Kết quả tạo thư mục
 */
export async function ensureDir(dirPath) {
    try {
        await fs.access(dirPath);
        return true;
    } catch (error) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return true;
        } catch (mkdirError) {
            console.error(`Lỗi khi tạo thư mục ${dirPath}:`, mkdirError);
            return false;
        }
    }
}