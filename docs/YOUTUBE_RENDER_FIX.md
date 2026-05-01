# YouTube Bot Detection on Render - Production Issue

## Current Status: ❌ All 5 Attempts Failing on Render

```
Attempt 1: Chrome cookies → Not found (expected - no browser)
Attempt 2: Firefox cookies → Not found (expected - no browser)  
Attempt 3: Android TV client → ❌ Bot detection
Attempt 4: iOS client → ❌ Bot detection  
Attempt 5: TV embedded client → ❌ Bot detection
```

**Root Cause:** Render's datacenter IP addresses are flagged by YouTube's anti-bot system.

---

## Why It Works Locally But Fails on Render

| Environment | IP Type | Chrome Cookies | Result |
|-------------|---------|----------------|--------|
| **Your PC** | Residential ISP | ✅ Available | ✅ Works (Attempt 1) |
| **Render** | Datacenter (AWS) | ❌ None | ❌ Blocked |

YouTube aggressively blocks downloads from known datacenter IPs without authenticated cookies.

---

## SOLUTIONS (Ordered by Feasibility)

### Solution 1: Make Video Public ⭐ EASIEST
**If the video is Private/Unlisted:**
1. Change video to **Public** on YouTube
2. Try download again
3. Bot detection is more lenient for public videos

**Verification:**
```bash
# Check if video is public
curl -s "https://www.youtube.com/watch?v=OaoL5mv16OI" | grep -i "private\|unlisted"
```

---

### Solution 2: Export Cookies to Render ⭐ RECOMMENDED

#### Step 1: Export Cookies from Your Browser
**Using Chrome Extension:**
1. Install: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
2. Go to YouTube and log in
3. Click extension → Export → Save as `youtube_cookies.txt`

**Manual Export (if extension doesn't work):**
```bash
# On Windows (PowerShell):
Copy-Item "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cookies" youtube_cookies.db

# Then use this Python script to convert:
python -c "
import browser_cookie3
cookies = browser_cookie3.chrome(domain_name='youtube.com')
with open('youtube_cookies.txt', 'w') as f:
    f.write('# Netscape HTTP Cookie File\n')
    for cookie in cookies:
        f.write(f'{cookie.domain}\tTRUE\t{cookie.path}\t{\"TRUE\" if cookie.secure else \"FALSE\"}\t{cookie.expires}\t{cookie.name}\t{cookie.value}\n')
"
```

#### Step 2: Add Cookies to Render
```bash
# Convert cookies to base64
base64 youtube_cookies.txt > youtube_cookies_b64.txt

# In Render Dashboard:
# Environment Variables → Add New
# Key: YOUTUBE_COOKIES_B64
# Value: <paste entire base64 content>
```

#### Step 3: Update Code to Use Cookies

Add this to `backend/utils/youtube.py` at the start of `download_youtube_video()`:

```python
import os
import base64

# Decode cookies from environment if available
cookies_b64 = os.getenv('YOUTUBE_COOKIES_B64')
if cookies_b64:
    cookie_file_path = Path('/tmp/youtube_cookies.txt')
    try:
        cookie_data = base64.b64decode(cookies_b64)
        cookie_file_path.write_bytes(cookie_data)
        logger.info("Loaded YouTube cookies from environment")
        
        # Add to first attempt
        download_attempts[0]['cookiefile'] = str(cookie_file_path)
    except Exception as e:
        logger.warning(f"Failed to decode cookies: {e}")
```

---

### Solution 3: Use Residential Proxy

**Add to `base_ydl_opts`:**
```python
'proxy': os.getenv('PROXY_URL'),  # e.g., 'http://user:pass@proxy.com:8080'
```

**Proxy Providers:**
- **Bright Data** (residential IPs): ~$500/mo
- **Smartproxy**: ~$75/mo for 5GB
- **Oxylabs**: ~$300/mo

**Free Alternative:**
```bash
# Use Tor (not recommended for production)
'proxy': 'socks5://127.0.0.1:9050'
```

---

### Solution 4: Use Alternative Download Method

**Option A: youtube-dl-server**
Deploy a separate service with residential IP:
```bash
# On a VPS with residential IP
docker run -d -p 8080:8080 nbr23/youtube-dl-server
```

**Option B: Direct ffmpeg Stream**
If video is public/embeddable:
```python
import subprocess

def download_via_ffmpeg(url, output_path):
    cmd = [
        'ffmpeg', '-i', url,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        output_path
    ]
    subprocess.run(cmd, check=True)
```

---

### Solution 5: Accept Only Public Videos

Update your UI to inform users:
```typescript
// frontend/src/components/VideoUpload.tsx
<Alert variant="warning">
  ⚠️ YouTube videos must be <strong>Public</strong> to download.
  Private/Unlisted videos require manual upload.
</Alert>
```

---

## Recommended Immediate Action

### For Production (Right Now):

1. **Check if video is public**:
   - Go to `https://www.youtube.com/watch?v=OaoL5mv16OI`
   - Look at visibility settings
   - If Private/Unlisted → Make Public or use direct upload

2. **Implement Cookie Solution** (15 minutes):
   ```bash
   # Export cookies
   # Add to Render environment
   # Redeploy
   ```

3. **Update Requirements**:
   ```python
   # requirements.txt - ensure latest yt-dlp
   yt-dlp>=2025.01.20  # Latest version with improved bypass
   ```

---

## Testing Different Videos

Try with a known public video first:
```python
# Test with this public video (should work):
test_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'  # Public domain
```

If public videos work but yours doesn't → **Your video needs to be public or you need cookies**.

---

## Long-term Architecture

```
┌─────────────────┐
│  User Frontend  │
└────────┬────────┘
         │
    ┌────▼────────────────────────────┐
    │ Option 1: Direct Upload (10GB)  │
    │ Option 2: YouTube URL (12GB)    │
    └────┬───────────────┬────────────┘
         │               │
         │          ┌────▼──────────────────┐
         │          │ Cookie-based Download │
         │          │ (Render + Cookies)    │
         │          └───────────────────────┘
         │
    ┌────▼─────────────────────┐
    │  Process with OCR        │
    │  Generate Highlights     │
    └──────────────────────────┘
```

---

## Quick Decision Matrix

| Video Type | Size | Recommended Method |
|------------|------|-------------------|
| Private/Unlisted | Any | ❌ Won't work without cookies |
| Public | <10GB | ✅ Direct Upload |
| Public | 10-12GB | ✅ YouTube URL + Cookies |
| Public | >12GB | ⚠️ Trim first or split |

---

## Immediate Next Steps

1. **Check video visibility** - Is OaoL5mv16OI public?
2. **If private** → Export cookies OR make video public
3. **If public** → Try different public video first to isolate issue
4. **Deploy cookie solution** if needed

Would you like me to implement the cookie-based solution now?
