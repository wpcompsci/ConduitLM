// YouTube Source
(function (scope) {
  function match(url) {
    try {
      const host = new URL(url).hostname;
      return host === 'www.youtube.com';
    } catch (e) {
      return false;
    }
  }

  async function extract() {
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function readText(value) {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (value.simpleText) return value.simpleText;
      if (Array.isArray(value.runs)) {
        return value.runs.map((run) => run.text || '').join('');
      }
      return '';
    }

    function cloneValue(value) {
      if (!value) return null;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (e) {
        return null;
      }
    }

    function parseJsonBlock(text, marker) {
      const markerIndex = text.indexOf(marker);
      if (markerIndex === -1) return null;
      const braceIndex = text.indexOf('{', markerIndex + marker.length);
      if (braceIndex === -1) return null;
      let depth = 0;
      for (let i = braceIndex; i < text.length; i += 1) {
        const char = text[i];
        if (char === '{') depth += 1;
        if (char === '}') depth -= 1;
        if (depth === 0) {
          return text.slice(braceIndex, i + 1);
        }
      }
      return null;
    }

    function getPlayerResponseFromMoviePlayer() {
      const player = document.getElementById('movie_player');
      if (!player || typeof player.getPlayerResponse !== 'function') return null;
      const response = player.getPlayerResponse();
      return cloneValue(response);
    }

    function getPlayerResponseFromWindow() {
      const candidates = [];
      try {
        if (window.ytInitialPlayerResponse) {
          candidates.push(window.ytInitialPlayerResponse);
        }
      } catch (e) {
        // ignore
      }
      try {
        if (window.wrappedJSObject && window.wrappedJSObject.ytInitialPlayerResponse) {
          candidates.push(window.wrappedJSObject.ytInitialPlayerResponse);
        }
      } catch (e) {
        // ignore
      }
      for (const candidate of candidates) {
        const cloned = cloneValue(candidate);
        if (cloned) return cloned;
      }
      return null;
    }

    function getVideoDataFromPlayer() {
      const player = document.getElementById('movie_player');
      if (!player || typeof player.getVideoData !== 'function') return null;
      return cloneValue(player.getVideoData());
    }

    function getPlayerResponseFromConfig() {
      try {
        if (window.ytplayer && window.ytplayer.config && window.ytplayer.config.args) {
          const responseText = window.ytplayer.config.args.player_response;
          if (responseText) {
            return JSON.parse(responseText);
          }
        }
      } catch (e) {
        return null;
      }
      return null;
    }

    function getPlayerResponseFromScripts() {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const text = script.textContent || '';
        if (!text.includes('ytInitialPlayerResponse')) continue;
        const block = parseJsonBlock(text, 'ytInitialPlayerResponse');
        if (!block) continue;
        try {
          return JSON.parse(block);
        } catch (e) {
          continue;
        }
      }
      return null;
    }

    async function getPlayerResponseWithRetry() {
      const attempts = 3;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const response =
          getPlayerResponseFromMoviePlayer() ||
          getPlayerResponseFromWindow() ||
          getPlayerResponseFromConfig() ||
          getPlayerResponseFromScripts();
        if (response) return response;
        if (attempt < attempts) {
          await sleep(250 * attempt);
        }
      }
      return null;
    }

    function getVideoIdFromUrl() {
      try {
        const parsed = new URL(location.href);
        if (parsed.pathname.startsWith('/watch')) {
          return parsed.searchParams.get('v') || '';
        }
        if (parsed.pathname.startsWith('/shorts/')) {
          const parts = parsed.pathname.split('/');
          return parts[2] || '';
        }
        if (parsed.pathname.startsWith('/live/')) {
          const parts = parsed.pathname.split('/');
          return parts[2] || '';
        }
      } catch (e) {
        return '';
      }
      return '';
    }

    function getCaptionTracks(playerResponse) {
      if (!playerResponse || !playerResponse.captions) return [];
      const renderer = playerResponse.captions.playerCaptionsTracklistRenderer;
      if (!renderer || !Array.isArray(renderer.captionTracks)) return [];
      return renderer.captionTracks
        .map((track) => ({
          baseUrl: track.baseUrl || '',
          languageCode: track.languageCode || '',
          name: readText(track.name),
          kind: track.kind || '',
        }))
        .filter((track) => track.baseUrl || track.languageCode);
    }

    function getTitleFromDom() {
      const selectors = [
        'h1.ytd-watch-metadata yt-formatted-string',
        '#title h1 yt-formatted-string',
        'h1#title yt-formatted-string',
        'h1.title yt-formatted-string',
        'meta[name="title"]',
        'meta[property="og:title"]',
      ];
      for (const selector of selectors) {
        const node = document.querySelector(selector);
        if (!node) continue;
        if (node.content) {
          const content = node.content.trim();
          if (content) return content;
        }
        const text = node.textContent ? node.textContent.trim() : '';
        if (text) return text;
      }
      return '';
    }

    function getChannelFromDom() {
      const selectors = [
        'ytd-channel-name a',
        '#channel-name #text a',
        '#owner #text',
        'ytd-video-owner-renderer a',
        'meta[name="author"]',
      ];
      for (const selector of selectors) {
        const node = document.querySelector(selector);
        if (!node) continue;
        if (node.content) {
          const content = node.content.trim();
          if (content) return content;
        }
        const text = node.textContent ? node.textContent.trim() : '';
        if (text) return text;
      }
      return '';
    }

    const defaultFetchOptions = {
      credentials: 'include',
      referrer: 'https://www.youtube.com/',
      referrerPolicy: 'origin-when-cross-origin',
      cache: 'no-cache',
    };

    async function fetchTimedTextTracks(videoId) {
      const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(
        videoId
      )}`;
      const response = await fetch(listUrl, defaultFetchOptions);
      if (!response.ok) {
        throw new Error(`Track list fetch failed: ${response.status}`);
      }
      const text = await response.text();
      if (!text) return [];
      const doc = new DOMParser().parseFromString(text, 'text/xml');
      const trackEls = Array.from(doc.getElementsByTagName('track'));
      return trackEls
        .map((track) => {
          const langCode = track.getAttribute('lang_code') || '';
          if (!langCode) return null;
          const name = track.getAttribute('name') || track.getAttribute('lang_translated') || '';
          const kind = track.getAttribute('kind') || '';
          let baseUrl = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(
            videoId
          )}&lang=${encodeURIComponent(langCode)}`;
          if (kind) {
            baseUrl += `&kind=${encodeURIComponent(kind)}`;
          }
          if (name) {
            baseUrl += `&name=${encodeURIComponent(name)}`;
          }
          return {
            baseUrl,
            languageCode: langCode,
            name,
            kind,
          };
        })
        .filter(Boolean);
    }

    function reorderTracks(tracks) {
      const manual = tracks.filter((track) => track.kind !== 'asr');
      const asr = tracks.filter((track) => track.kind === 'asr');
      return manual.concat(asr);
    }

    function buildUrlWithParam(rawUrl, key, value) {
      if (!rawUrl) return '';
      try {
        const parsed = new URL(rawUrl, location.href);
        parsed.searchParams.set(key, value);
        return parsed.toString();
      } catch (e) {
        return rawUrl;
      }
    }

    function stripJsonPrefix(text) {
      if (!text) return '';
      const trimmed = text.trim();
      if (trimmed.startsWith(")]}'")) {
        const index = trimmed.indexOf('\n');
        return index === -1 ? '' : trimmed.slice(index + 1);
      }
      return trimmed;
    }

    function parseJson3(data) {
      if (!data || !Array.isArray(data.events)) return '';
      const lines = [];
      for (const event of data.events) {
        if (!event.segs) continue;
        const line = event.segs.map((seg) => seg.utf8 || '').join('');
        const cleaned = line.replace(/\s+/g, ' ').trim();
        if (cleaned) lines.push(cleaned);
      }
      return lines.join('\n').trim();
    }

    function parseTranscriptXml(text) {
      const doc = new DOMParser().parseFromString(text, 'text/xml');
      const nodes = Array.from(doc.getElementsByTagName('text'));
      if (!nodes.length) return '';
      const lines = nodes
        .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return lines.join('\n').trim();
    }

    function parseTranscriptVtt(text) {
      const lines = text.split(/\r?\n/);
      const output = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'WEBVTT') continue;
        if (trimmed.includes('-->')) continue;
        if (/^\d+$/.test(trimmed)) continue;
        if (trimmed.startsWith('NOTE')) continue;
        output.push(trimmed);
      }
      return output.join('\n').trim();
    }

    function parseTranscriptText(text) {
      if (!text) return '';
      if (text.includes('<transcript') || text.includes('<text')) {
        return parseTranscriptXml(text);
      }
      if (text.startsWith('WEBVTT')) {
        return parseTranscriptVtt(text);
      }
      return '';
    }

    function buildDirectTimedTextUrl(videoId, track, fmt) {
      if (!videoId || !track || !track.languageCode) return '';
      let url = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(
        videoId
      )}&lang=${encodeURIComponent(track.languageCode)}`;
      if (track.kind) {
        url += `&kind=${encodeURIComponent(track.kind)}`;
      }
      if (track.name) {
        url += `&name=${encodeURIComponent(track.name)}`;
      }
      if (fmt) {
        url += `&fmt=${encodeURIComponent(fmt)}`;
      }
      return url;
    }

    async function fetchTranscriptFromTrack(track, videoId) {
      if (!track || !track.baseUrl) {
        if (!track || !track.languageCode) {
          return { transcript: '', error: 'missing_base_url' };
        }
      }

      const candidates = [];
      if (track.baseUrl) {
        const baseUrl = track.baseUrl;
        candidates.push(
          buildUrlWithParam(baseUrl, 'fmt', 'json3'),
          buildUrlWithParam(baseUrl, 'fmt', 'vtt'),
          buildUrlWithParam(baseUrl, 'fmt', 'ttml'),
          buildUrlWithParam(baseUrl, 'fmt', 'srv3'),
          buildUrlWithParam(baseUrl, 'fmt', 'srv2'),
          buildUrlWithParam(baseUrl, 'fmt', 'srv1'),
          baseUrl
        );
      }
      if (videoId) {
        candidates.push(
          buildDirectTimedTextUrl(videoId, track, 'json3'),
          buildDirectTimedTextUrl(videoId, track, 'vtt'),
          buildDirectTimedTextUrl(videoId, track, 'ttml'),
          buildDirectTimedTextUrl(videoId, track, 'srv3'),
          buildDirectTimedTextUrl(videoId, track, 'srv2'),
          buildDirectTimedTextUrl(videoId, track, 'srv1'),
          buildDirectTimedTextUrl(videoId, track, '')
        );
      }

      const uniqueCandidates = candidates.filter(
        (url, index, all) => url && all.indexOf(url) === index
      );

      let lastError = '';

      for (const url of uniqueCandidates) {
        try {
          const response = await fetch(url, defaultFetchOptions);
          if (!response.ok) {
            lastError = `http_${response.status}`;
            continue;
          }
          if (response.status === 204 || response.status === 205) {
            lastError = `http_${response.status}`;
            continue;
          }
          const rawText = await response.text();
          const trimmed = stripJsonPrefix(rawText);
          if (!trimmed) {
            lastError = 'empty_response';
            continue;
          }
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              const data = JSON.parse(trimmed);
              const transcript = parseJson3(data);
              if (transcript) return { transcript, error: '' };
              lastError = 'json_parse_empty';
              continue;
            } catch (e) {
              lastError = 'json_parse_failed';
            }
          }
          const transcript = parseTranscriptText(trimmed);
          if (transcript) return { transcript, error: '' };
          lastError = 'text_parse_failed';
        } catch (error) {
          lastError = error && error.message ? error.message : 'fetch_failed';
        }
      }

      return { transcript: '', error: lastError || 'fetch_failed' };
    }

    function getCookieValue(name) {
      const match = document.cookie.match(
        new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
      );
      return match ? decodeURIComponent(match[1]) : '';
    }

    async function sha1Hex(value) {
      if (!value || !crypto || !crypto.subtle) return '';
      const bytes = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest('SHA-1', bytes);
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }

    async function computeSapIsidHash() {
      const sapisid = getCookieValue('SAPISID') || getCookieValue('__Secure-3PAPISID');
      if (!sapisid) return '';
      const timestamp = Math.floor(Date.now() / 1000);
      const hash = await sha1Hex(`${timestamp} ${sapisid} https://www.youtube.com`);
      if (!hash) return '';
      return `SAPISIDHASH ${timestamp}_${hash}`;
    }

    function readScriptValue(text, pattern) {
      const match = pattern.exec(text);
      return match && match[1] ? match[1] : '';
    }

    function extractYtCfgFromScripts() {
      const cfg = {};
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const text = script.textContent || '';
        if (!text.includes('INNERTUBE_API_KEY') && !text.includes('ytcfg')) continue;
        cfg.accept_language =
          cfg.accept_language || readScriptValue(text, /"accept_language":"(.*?)"/);
        cfg.INNERTUBE_CONTEXT_CLIENT_NAME =
          cfg.INNERTUBE_CONTEXT_CLIENT_NAME ||
          readScriptValue(text, /"INNERTUBE_CONTEXT_CLIENT_NAME":([0-9]*)/);
        cfg.INNERTUBE_CONTEXT_CLIENT_VERSION =
          cfg.INNERTUBE_CONTEXT_CLIENT_VERSION ||
          readScriptValue(text, /"INNERTUBE_CONTEXT_CLIENT_VERSION":"(.*?)"/);
        cfg.INNERTUBE_CONTEXT_GL =
          cfg.INNERTUBE_CONTEXT_GL || readScriptValue(text, /"INNERTUBE_CONTEXT_GL":"(.*?)"/);
        cfg.INNERTUBE_CONTEXT_HL =
          cfg.INNERTUBE_CONTEXT_HL || readScriptValue(text, /"INNERTUBE_CONTEXT_HL":"(.*?)"/);
        cfg.DEVICE = cfg.DEVICE || readScriptValue(text, /"DEVICE":"(.*?)"/);
        cfg.ID_TOKEN = cfg.ID_TOKEN || readScriptValue(text, /"ID_TOKEN":"(.*?)"/);
        cfg.PAGE_CL = cfg.PAGE_CL || readScriptValue(text, /"PAGE_CL":(.*?),/);
        cfg.PAGE_BUILD_LABEL =
          cfg.PAGE_BUILD_LABEL || readScriptValue(text, /"PAGE_BUILD_LABEL":"(.*?)"/);
        cfg.INNERTUBE_API_KEY =
          cfg.INNERTUBE_API_KEY || readScriptValue(text, /"INNERTUBE_API_KEY":"(.*?)"/);
        cfg.DELEGATED_SESSION_ID =
          cfg.DELEGATED_SESSION_ID || readScriptValue(text, /"DELEGATED_SESSION_ID":"(.*?)"/);
        cfg.SESSION_INDEX =
          cfg.SESSION_INDEX || readScriptValue(text, /"SESSION_INDEX":"(.*?)"/);
        cfg.visitorData =
          cfg.visitorData || readScriptValue(text, /"visitorData":"(.*?)"/);
      }
      return cfg;
    }

    function extractYtCfgFromWindow() {
      const cfg = {};
      try {
        const source =
          window.ytcfg ||
          (window.wrappedJSObject && window.wrappedJSObject.ytcfg) ||
          null;
        if (!source) return cfg;
        if (typeof source.get === 'function') {
          cfg.INNERTUBE_API_KEY = source.get('INNERTUBE_API_KEY') || '';
          cfg.INNERTUBE_CONTEXT_CLIENT_NAME = source.get('INNERTUBE_CONTEXT_CLIENT_NAME') || '';
          cfg.INNERTUBE_CONTEXT_CLIENT_VERSION =
            source.get('INNERTUBE_CONTEXT_CLIENT_VERSION') || '';
          cfg.INNERTUBE_CONTEXT_GL = source.get('INNERTUBE_CONTEXT_GL') || '';
          cfg.INNERTUBE_CONTEXT_HL = source.get('INNERTUBE_CONTEXT_HL') || '';
          cfg.DEVICE = source.get('DEVICE') || '';
          cfg.ID_TOKEN = source.get('ID_TOKEN') || '';
          cfg.PAGE_CL = source.get('PAGE_CL') || '';
          cfg.PAGE_BUILD_LABEL = source.get('PAGE_BUILD_LABEL') || '';
          cfg.DELEGATED_SESSION_ID = source.get('DELEGATED_SESSION_ID') || '';
          cfg.SESSION_INDEX = source.get('SESSION_INDEX') || '';
          cfg.visitorData = source.get('VISITOR_DATA') || source.get('VISITOR_DATA') || '';
          cfg.accept_language = source.get('INNERTUBE_CONTEXT_HL') || '';
        } else if (typeof source === 'object') {
          cfg.INNERTUBE_API_KEY = source.INNERTUBE_API_KEY || '';
          cfg.INNERTUBE_CONTEXT_CLIENT_NAME = source.INNERTUBE_CONTEXT_CLIENT_NAME || '';
          cfg.INNERTUBE_CONTEXT_CLIENT_VERSION = source.INNERTUBE_CONTEXT_CLIENT_VERSION || '';
          cfg.INNERTUBE_CONTEXT_GL = source.INNERTUBE_CONTEXT_GL || '';
          cfg.INNERTUBE_CONTEXT_HL = source.INNERTUBE_CONTEXT_HL || '';
          cfg.DEVICE = source.DEVICE || '';
          cfg.ID_TOKEN = source.ID_TOKEN || '';
          cfg.PAGE_CL = source.PAGE_CL || '';
          cfg.PAGE_BUILD_LABEL = source.PAGE_BUILD_LABEL || '';
          cfg.DELEGATED_SESSION_ID = source.DELEGATED_SESSION_ID || '';
          cfg.SESSION_INDEX = source.SESSION_INDEX || '';
          cfg.visitorData = source.visitorData || '';
          cfg.accept_language = source.accept_language || '';
        }
      } catch (e) {
        return cfg;
      }
      return cfg;
    }

    function mergeYtCfg() {
      const windowCfg = extractYtCfgFromWindow();
      const scriptCfg = extractYtCfgFromScripts();
      return Object.assign({}, windowCfg, scriptCfg);
    }

    async function fetchPlayerResponseFromYoutubeI(videoId) {
      const cfg = mergeYtCfg();
      const apiKey = cfg.INNERTUBE_API_KEY || '';
      if (!apiKey) {
        return { error: 'missing_innertube_key' };
      }
      const clientName = cfg.INNERTUBE_CONTEXT_CLIENT_NAME || '1';
      const clientVersion = cfg.INNERTUBE_CONTEXT_CLIENT_VERSION || '';
      const hl = cfg.INNERTUBE_CONTEXT_HL || 'en';
      const gl = cfg.INNERTUBE_CONTEXT_GL || 'US';
      const headers = {
        accept: '*/*',
        'content-type': 'application/json',
        'x-youtube-client-name': String(clientName),
        'x-youtube-client-version': String(clientVersion),
        origin: 'https://www.youtube.com',
        'x-origin': 'https://www.youtube.com',
      };

      if (cfg.SESSION_INDEX) headers['x-goog-authuser'] = cfg.SESSION_INDEX;
      if (cfg.visitorData) headers['x-goog-visitor-id'] = cfg.visitorData;
      if (cfg.DELEGATED_SESSION_ID) headers['x-goog-pageid'] = cfg.DELEGATED_SESSION_ID;
      if (cfg.DEVICE) headers['x-youtube-device'] = cfg.DEVICE;
      if (cfg.ID_TOKEN) headers['x-youtube-identity-token'] = cfg.ID_TOKEN;
      if (cfg.PAGE_CL) headers['x-youtube-page-cl'] = cfg.PAGE_CL;
      if (cfg.PAGE_BUILD_LABEL) headers['x-youtube-page-label'] = cfg.PAGE_BUILD_LABEL;

      const authHeader = await computeSapIsidHash();
      if (authHeader) headers.authorization = authHeader;

      const body = {
        context: {
          client: {
            clientName: String(clientName),
            clientVersion,
            hl,
            gl,
          },
        },
        videoId,
        playbackContext: {
          contentPlaybackContext: {
            html5Preference: 'HTML5_PREF_WANTS',
          },
        },
        racyCheckOk: true,
        contentCheckOk: true,
      };

      const response = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
          referrer: 'https://www.youtube.com/',
          referrerPolicy: 'origin-when-cross-origin',
          headers,
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        return { error: `player_http_${response.status}` };
      }

      const data = await response.json();
      if (!data || typeof data !== 'object') {
        return { error: 'player_invalid_response' };
      }

      return { playerResponse: data };
    }

    async function tryTracks(tracks, videoId) {
      const candidates = reorderTracks(tracks || []);
      let lastError = '';
      for (const track of candidates) {
        const result = await fetchTranscriptFromTrack(track, videoId);
        if (result.transcript) {
          return {
            transcript: result.transcript,
            language: track.languageCode || '',
            trackName: track.name || '',
            trackKind: track.kind || '',
            transcriptError: '',
          };
        }
        if (result.error) {
          lastError = result.error;
        }
      }
      return {
        transcript: '',
        language: '',
        trackName: '',
        trackKind: '',
        transcriptError: lastError,
      };
    }

    const url = location.href;
    const videoIdFromUrl = getVideoIdFromUrl();
    let playerResponse = await getPlayerResponseWithRetry();
    let resolvedVideoId = videoIdFromUrl;
    const playerVideoData = getVideoDataFromPlayer();
    let primaryTrackSource = '';
    let primaryTracks = [];
    let timedTextTracks = [];
    let timedTextError = null;

    if (!resolvedVideoId && playerVideoData && playerVideoData.video_id) {
      resolvedVideoId = playerVideoData.video_id;
    }
    if (!resolvedVideoId && playerResponse && playerResponse.videoDetails) {
      resolvedVideoId = playerResponse.videoDetails.videoId || '';
    }

    const responseVideoId =
      playerResponse && playerResponse.videoDetails ? playerResponse.videoDetails.videoId : '';
    if (resolvedVideoId && responseVideoId && resolvedVideoId !== responseVideoId) {
      playerResponse = null;
    }

    primaryTracks = getCaptionTracks(playerResponse);
    if (primaryTracks.length) {
      primaryTrackSource = 'player_response';
    }

    if (!primaryTracks.length && resolvedVideoId) {
      try {
        const apiResult = await fetchPlayerResponseFromYoutubeI(resolvedVideoId);
        if (apiResult && apiResult.playerResponse) {
          if (!playerResponse) {
            playerResponse = apiResult.playerResponse;
          }
          primaryTracks = getCaptionTracks(apiResult.playerResponse);
          if (primaryTracks.length) {
            primaryTrackSource = 'youtubei_player';
          }
        } else if (apiResult && apiResult.error) {
          timedTextError = new Error(apiResult.error);
        }
      } catch (error) {
        timedTextError = error;
      }
    }

    if (resolvedVideoId) {
      try {
        timedTextTracks = await fetchTimedTextTracks(resolvedVideoId);
      } catch (error) {
        timedTextError = error;
      }
    }

    if (!resolvedVideoId && playerResponse && playerResponse.videoDetails) {
      resolvedVideoId = playerResponse.videoDetails.videoId || '';
    }

    const details = playerResponse && playerResponse.videoDetails ? playerResponse.videoDetails : {};
    const microformat =
      playerResponse && playerResponse.microformat
        ? playerResponse.microformat.playerMicroformatRenderer
        : null;
    const domTitle = getTitleFromDom();
    const domChannel = getChannelFromDom();
    const playerTitle = playerVideoData && playerVideoData.title ? playerVideoData.title : '';
    const playerChannel =
      playerVideoData && playerVideoData.author ? playerVideoData.author : '';
    const title =
      playerTitle ||
      details.title ||
      (microformat && readText(microformat.title)) ||
      domTitle ||
      (document.title || 'YouTube Video').replace(' - YouTube', '').trim();
    const channel =
      playerChannel ||
      details.author ||
      (microformat && microformat.ownerChannelName) ||
      domChannel ||
      '';
    const isLive = Boolean(
      details.isLiveContent || (microformat && microformat.liveBroadcastDetails)
    );

    let transcript = '';
    let language = '';
    let trackName = '';
    let trackKind = '';
    let transcriptStatus = 'missing';
    let transcriptError = '';
    let trackSource = '';

    if (!resolvedVideoId) {
      transcriptStatus = 'no_video_id';
    } else {
      const primaryResult = await tryTracks(primaryTracks, resolvedVideoId);
      if (primaryResult.transcript) {
        transcript = primaryResult.transcript;
        language = primaryResult.language;
        trackName = primaryResult.trackName;
        trackKind = primaryResult.trackKind;
        transcriptStatus = 'ok';
        transcriptError = '';
        trackSource = primaryTrackSource;
      } else {
        const fallbackResult = await tryTracks(timedTextTracks, resolvedVideoId);
        if (fallbackResult.transcript) {
          transcript = fallbackResult.transcript;
          language = fallbackResult.language;
          trackName = fallbackResult.trackName;
          trackKind = fallbackResult.trackKind;
          transcriptStatus = 'ok';
          transcriptError = '';
          trackSource = primaryTrackSource ? 'timedtext_fallback' : 'timedtext';
        } else if (!primaryTracks.length && !timedTextTracks.length && timedTextError) {
          transcriptStatus = 'track_list_failed';
          transcriptError = timedTextError.message || 'track_list_failed';
          trackSource = primaryTrackSource || 'timedtext';
        } else if (!primaryTracks.length && !timedTextTracks.length) {
          transcriptStatus = 'no_tracks';
          trackSource = primaryTrackSource || 'timedtext';
        } else {
          const combinedError =
            fallbackResult.transcriptError || primaryResult.transcriptError || '';
          transcriptStatus = combinedError ? 'fetch_failed' : 'empty';
          transcriptError = combinedError;
          trackSource = primaryTrackSource
            ? `${primaryTrackSource}|timedtext`
            : 'timedtext';
        }
      }
    }

    const captionTrackCount =
      primaryTracks.length > 0 ? primaryTracks.length : timedTextTracks.length;

    return {
      title,
      url,
      videoId: resolvedVideoId,
      channel,
      transcript,
      language,
      trackName,
      trackKind,
      isLive,
      captionTrackCount,
      transcriptStatus,
      trackSource,
      transcriptError,
      fallbackTrackCount: timedTextTracks.length,
    };
  }

  scope.SourceRegistry.register({
    id: 'youtube',
    label: 'YouTube Video',
    match,
    extract,
  });
})(globalThis);
