const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const YT_DLP_PATH = path.resolve(__dirname, 'bin', 'yt-dlp');

// Middleware
// Middleware
app.use(cors({
    origin: '*', // Allow all origins (Vercel, Localhost, etc.)
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Health Check
app.get('/', (req, res) => {
    res.send('Video Downloader API is running...');
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'active', time: new Date().toISOString(), server: 'NeoDownloader v1.0' });
});

// Helper to spawn yt-dlp and get JSON output
const getVideoInfo = (url) => {
    return new Promise((resolve, reject) => {
        const args = [
            '--dump-single-json',
            '--no-warnings',
            '--no-check-certificate',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            '--referer', 'https://vk.com/',
            '--extractor-args', 'youtube:player_client=android', // Added to bypass "Sign in to confirm"
            '--add-header', 'Accept-Language: en-US,en;q=0.9',
            url
        ];

        const process = spawn(YT_DLP_PATH, args);

        let stdoutData = '';
        let stderrData = '';

        process.stdout.on('data', (chunk) => {
            stdoutData += chunk;
        });

        process.stderr.on('data', (chunk) => {
            stderrData += chunk;
        });

        process.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`yt-dlp exited with code ${code}: ${stderrData}`));
            }
            try {
                const json = JSON.parse(stdoutData);
                resolve(json);
            } catch (err) {
                reject(new Error('Failed to parse JSON output'));
            }
        });

        process.on('error', (err) => {
            reject(err);
        });
    });
};

// Route: Get Video Info
app.post('/api/info', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const output = await getVideoInfo(url);

        const info = {
            title: output.title,
            thumbnail: output.thumbnail,
            duration: output.duration,
            formats: output.formats.map(f => ({
                format_id: f.format_id,
                ext: f.ext,
                resolution: f.resolution || `${f.width}x${f.height}`,
                height: f.height,
                width: f.width,
                filesize: f.filesize,
                vcodec: f.vcodec,
                acodec: f.acodec,
                note: f.format_note,
                fps: f.fps,
                // Helper to identify tracks
                isVideo: f.vcodec !== 'none',
                isAudio: f.acodec !== 'none'
            }))
        };

        res.json(info);
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video information', details: error.message });
    }
});

// Route: Stream Video Download
app.get('/api/download', async (req, res) => {
    const { url, video_id, audio_id, ext, title } = req.query;

    if (!url) {
        return res.status(400).send('URL is required');
    }

    const safeTitle = (title || 'video').replace(/[^a-z0-9]/gi, '_');
    const filename = `${safeTitle}.${ext || 'mp4'}`;

    res.header('Content-Disposition', `attachment; filename="${filename}"`);

    try {
        const args = [
            '-o', '-',
            '--no-warnings',
            '--no-check-certificate',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            '--referer', 'https://vk.com/',
            '--extractor-args', 'youtube:player_client=android', // Bypass "Sign in to confirm"
            '--add-header', 'Accept-Language: en-US,en;q=0.9',
            url
        ];

        let formatSelector = 'best';
        if (video_id && audio_id) {
            formatSelector = `${video_id}+${audio_id}`;
            // When merging, we need ffmpeg. yt-dlp to stdout with merge is tricky.
            // Usually we pipe raw data.
            // If merging, we can't pipe directly to res easily without intermediate file or complex pipe.
            // For now, let's trust the existing logic usage.
            // Wait, existing logic was:
            // if (video_id && audio_id) { formatSelector = ... }
            // args.push('-f', formatSelector);
            // const subprocess = spawn(YT_DLP_PATH, args);
            // subprocess.stdout.pipe(res);
        } else if (video_id) {
            formatSelector = video_id;
        }

        args.unshift('-f', formatSelector);

        const subprocess = spawn(YT_DLP_PATH, args);

        subprocess.stdout.pipe(res);

        subprocess.stderr.on('data', (data) => {
            // console.error(`stderr: ${data}`);
        });

        subprocess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Download process exited with code ${code}`);
            }
            res.end();
        });

        // Handle client disconnect
        req.on('close', () => {
            subprocess.kill();
        });

    } catch (error) {
        console.error('Download setup error:', error);
        if (!res.headersSent) {
            res.status(500).send('Download failed');
        }
    }
});

// Update yt-dlp binary
app.post('/api/update', async (req, res) => {
    try {
        console.log('Starting yt-dlp update...');
        const process = spawn(YT_DLP_PATH, ['-U']);

        let output = '';
        process.stdout.on('data', (data) => { output += data.toString(); });
        process.stderr.on('data', (data) => { output += data.toString(); });

        process.on('close', (code) => {
            if (code === 0) {
                res.json({ success: true, message: 'Update successful', output });
            } else {
                res.status(500).json({ success: false, message: 'Update failed', output });
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
