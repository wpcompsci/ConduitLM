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

    async function fetchTimedTextTracks(videoId) {
      const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(
        videoId
      )}`;
      const response = await fetch(listUrl, { credentials: 'include' });
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

    function chooseTrack(tracks) {
      const manual = tracks.find((track) => track.kind !== 'asr');
      return manual || tracks[0] || null;
    }

    function appendJsonFormat(url) {
      if (!url) return '';
      if (url.includes('fmt=')) return url;
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}fmt=json3`;
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

    async function fetchTranscriptFromTrack(track) {
      if (!track || !track.baseUrl) return '';
      const url = appendJsonFormat(track.baseUrl);
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Transcript fetch failed: ${response.status}`);
      }
      let data = null;
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (err) {
          return '';
        }
      }
      return parseJson3(data);
    }

    const url = location.href;
    const videoIdFromUrl = getVideoIdFromUrl();
    const playerResponse = await getPlayerResponseWithRetry();
    const details = playerResponse && playerResponse.videoDetails ? playerResponse.videoDetails : {};
    const microformat =
      playerResponse && playerResponse.microformat
        ? playerResponse.microformat.playerMicroformatRenderer
        : null;
    const resolvedVideoId = videoIdFromUrl || details.videoId || '';
    const title =
      details.title ||
      (microformat && readText(microformat.title)) ||
      (document.title || 'YouTube Video').replace(' - YouTube', '').trim();
    const channel = details.author || (microformat && microformat.ownerChannelName) || '';
    const isLive = Boolean(
      details.isLiveContent || (microformat && microformat.liveBroadcastDetails)
    );

    let captionTracks = getCaptionTracks(playerResponse);
    let trackSource = captionTracks.length ? 'player_response' : '';
    let transcriptStatus = 'missing';
    let trackListError = null;

    if (!captionTracks.length && resolvedVideoId) {
      try {
        captionTracks = await fetchTimedTextTracks(resolvedVideoId);
        if (captionTracks.length) {
          trackSource = 'timedtext';
        }
      } catch (error) {
        trackListError = error;
      }
    }

    let transcript = '';
    let language = '';
    let trackName = '';
    let trackKind = '';

    if (!resolvedVideoId) {
      transcriptStatus = 'no_video_id';
    } else if (!captionTracks.length && trackListError) {
      transcriptStatus = 'track_list_failed';
    } else if (!captionTracks.length) {
      transcriptStatus = 'no_tracks';
    } else {
      const selected = chooseTrack(captionTracks);
      if (selected) {
        language = selected.languageCode || '';
        trackName = selected.name || '';
        trackKind = selected.kind || '';
        try {
          transcript = await fetchTranscriptFromTrack(selected);
        } catch (error) {
          transcriptStatus = 'fetch_failed';
        }
      }
      if (transcript) {
        transcriptStatus = 'ok';
      } else if (transcriptStatus === 'missing') {
        transcriptStatus = 'empty';
      }
    }

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
      captionTrackCount: captionTracks.length,
      transcriptStatus,
      trackSource,
    };
  }

  scope.SourceRegistry.register({
    id: 'youtube',
    label: 'YouTube Video',
    match,
    extract,
  });
})(globalThis);
