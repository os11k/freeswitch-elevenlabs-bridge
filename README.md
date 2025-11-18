# FreeSWITCH WebSocket Audio Bridge for ElevenLabs

A WebSocket server that bridges FreeSWITCH's `mod_audio_stream` with ElevenLabs Conversational AI, enabling real-time voice conversations through FreeSWITCH.

## Features

- Real-time audio streaming between FreeSWITCH and ElevenLabs
- Automatic audio format handling (16kHz PCM L16)
- Buffered audio streaming with 200ms warmup for smooth playback
- Docker-based deployment for easy setup

## Prerequisites

- Docker and Docker Compose
- ElevenLabs account with a Conversational AI agent
- FreeSWITCH with `mod_audio_stream` enabled

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/os11k/freeswitch-elevenlabs-bridge
cd freeswitch-elevenlabs-bridge
```

### 2. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your ElevenLabs Agent ID:

```
ELEVENLABS_AGENT_ID=your_actual_agent_id_here
```

**Getting your Agent ID:**
1. Go to [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)
2. Create or select your agent
3. **Important:** Configure your agent's audio settings to use **PCM 16000 Hz** format
4. Copy the Agent ID from your agent's settings

### 3. Start the server

```bash
docker compose up -d --build
```

The WebSocket server will be available at `ws://localhost:8080`

### 4. Configure FreeSWITCH

Add this dialplan extension to your FreeSWITCH configuration (e.g., in `/etc/freeswitch/dialplan/default.xml`).

**Important:** Update the IP address based on your setup:
- Use `127.0.0.1` if FreeSWITCH and the bridge are on the same machine
- Use your server's IP address if they are on different machines

```xml
<extension name="audio_stream_9999">
  <condition field="destination_number" expression="^9999$">
    <!-- Enable audio streaming and set sample rate to 16kHz -->
    <action application="set" data="STREAM_PLAYBACK=true"/>
    <action application="set" data="STREAM_SAMPLE_RATE=16000"/>

    <!-- Start WebSocket audio stream when call is answered -->
    <action application="set" data="api_on_answer=uuid_audio_stream ${uuid} start ws://127.0.0.1:8080 mono 16k"/>

    <action application="answer"/>
    <action application="park"/>
  </condition>
</extension>
```

**Usage:** Dial `9999` from any FreeSWITCH extension to connect to your ElevenLabs AI agent.

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ELEVENLABS_AGENT_ID` | Your ElevenLabs Conversational AI Agent ID | Yes |

### Port Configuration

The server listens on port `8080` by default. To change this:

1. Edit [docker-compose.yml](docker-compose.yml) to change the port mapping
2. Update [server.js](server.js) line 2 to match

## Architecture

```
FreeSWITCH (mod_audio_stream)
        ↓
   WebSocket Bridge (ws://localhost:8080)
        ↓
   ElevenLabs API (wss://api.elevenlabs.io)
```

### Audio Flow

**Incoming Audio (User → AI):**
 - FreeSWITCH sends raw PCM audio chunks via WebSocket
 - Server base64-encodes and forwards to ElevenLabs

## Development

### View logs

```bash
docker compose logs -f
```

### Stop the server

```bash
docker compose down
```

## Troubleshooting

### Connection issues

- Verify the WebSocket server is running: `docker compose ps`
- Check logs: `docker compose logs -f`
- Ensure port 8080 is not blocked by firewall

### Audio quality issues

- The server uses 16kHz sample rate with 200ms buffer warmup
- Check network latency between server and ElevenLabs API
- Monitor logs for WebSocket errors

### ElevenLabs connection errors

- Verify your `ELEVENLABS_AGENT_ID` is correct
- Check your ElevenLabs account status and API limits
- Ensure the agent is active in your ElevenLabs dashboard
