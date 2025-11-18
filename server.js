const WebSocket = require('ws');
const port = 8080;
const fs = require('fs');
const path = require('path');
let fileCount = 1;

console.log(`websocket listening on port ${port}`);

const wss = new WebSocket.Server({ port });

// Eleven Labs API credentials
const ELEVEN_LABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const ELEVEN_LABS_WS_URL = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVEN_LABS_AGENT_ID}`;

wss.on('connection', (ws, req) => {

    console.log(`received connection from ${req.connection.remoteAddress}`);

    const elevenLabs = new WebSocket(ELEVEN_LABS_WS_URL);

    let formatSent = false;
    let audioBuffer = [];
    let streamingInterval = null;

    const CHUNK_SIZE = 640; // 20ms @ 16kHz L16
    const BUFFER_WARMUP_CHUNKS = 10; // 200ms

    // Start streaming once buffer is ready
    function startStreaming() {
        if (streamingInterval) return; // already streaming

        streamingInterval = setInterval(() => {
            if (audioBuffer.length === 0) {
                clearInterval(streamingInterval);
                streamingInterval = null;
                return;
            }

            const chunk = audioBuffer.shift();
            ws.send(chunk);
        }, 20);
    }

    elevenLabs.on('open', () => {
        console.log('Connected to Eleven Labs');
    });

    ws.on('message', (message) => {
        if (message instanceof Buffer) {
            const base64Audio = message.toString('base64');
            const payload = JSON.stringify({ user_audio_chunk: base64Audio });

            if (elevenLabs.readyState === WebSocket.OPEN) {
                elevenLabs.send(payload);
            }
        }
    });

    elevenLabs.on('message', (data) => {
        try {
            const response = JSON.parse(data.toString());

            if (response.type === "ping") {
                const pong = {
                    type: "pong",
                    event_id: response.ping_event.event_id
                };
                elevenLabs.send(JSON.stringify(pong));
                return;
            }

            if (response.type === "audio") {
                const decodedBuffer = Buffer.from(response.audio_event.audio_base_64, 'base64');

                if (!formatSent) {
                    const formatMsg = JSON.stringify({
                        type: "rawAudio",
                        data: {
                            sampleRate: 16000
                        }
                    });
                    ws.send(formatMsg);
                    formatSent = true;
                }

                // Break audio into 640-byte chunks
                for (let i = 0; i < decodedBuffer.length; i += CHUNK_SIZE) {
                    const chunk = decodedBuffer.slice(i, i + CHUNK_SIZE);
                    audioBuffer.push(chunk);
                }

                // Start streaming once we've warmed up
                if (audioBuffer.length >= BUFFER_WARMUP_CHUNKS && !streamingInterval) {
                    startStreaming();
                }

            } else {
                console.log('[ElevenLabs] Non-audio response:', response);
            }

        } catch (err) {
            console.error('Error processing ElevenLabs response:', err);
        }
    });

    elevenLabs.on('close', () => {
        console.log('Disconnected from Eleven Labs');
    });

    elevenLabs.on('error', (err) => {
        console.error('Eleven Labs WebSocket Error:', err);
    });

    ws.on('close', (code, reason) => {
        console.log(`socket closed ${code}:${reason}`);
        elevenLabs.close();
        if (streamingInterval) {
            clearInterval(streamingInterval);
            streamingInterval = null;
        }
    });

});
