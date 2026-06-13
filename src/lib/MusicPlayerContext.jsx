import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

const MusicPlayerContext = createContext(null);

let ytApiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

export function MusicPlayerProvider({ children }) {
  const [videoId, setVideoId] = useState(null);
  const [title, setTitle] = useState('');
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      // Creamos el div manualmente: YT puede reemplazarlo sin que React se queje
      const target = document.createElement('div');
      containerRef.current.appendChild(target);
      playerRef.current = new YT.Player(target, {
        height: '1',
        width: '1',
        playerVars: { playsinline: 1 },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e) => {
            if (e.data === 1) setPlaying(true);
            else if (e.data === 2 || e.data === 0) setPlaying(false);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !videoId) return;
    const interval = setInterval(() => {
      const t = playerRef.current?.getCurrentTime?.();
      if (typeof t === 'number') setCurrentTime(t);
    }, 1000);
    return () => clearInterval(interval);
  }, [ready, videoId]);

  const play = useCallback((id, opts = {}) => {
    const player = playerRef.current;
    if (!player || !ready) return;
    if (id !== videoId) {
      player.loadVideoById(id, opts.startSeconds || 0);
      setVideoId(id);
      setTitle(opts.title || '');
    } else if (opts.startSeconds != null) {
      player.seekTo(opts.startSeconds, true);
    }
    player.playVideo();
  }, [ready, videoId]);

  const pause = useCallback(() => playerRef.current?.pauseVideo?.(), []);
  const resume = useCallback(() => playerRef.current?.playVideo?.(), []);
  const togglePlay = useCallback(() => { playing ? pause() : resume(); }, [playing, pause, resume]);
  const seekTo = useCallback((t) => playerRef.current?.seekTo?.(t, true), []);
  const close = useCallback(() => {
    playerRef.current?.stopVideo?.();
    setVideoId(null);
    setTitle('');
    setPlaying(false);
  }, []);

  return (
    <MusicPlayerContext.Provider
      value={{ videoId, title, playing, ready, currentTime, play, pause, resume, togglePlay, seekTo, close }}
    >
      {children}
      <div
        ref={containerRef}
        style={{ position: 'fixed', width: 1, height: 1, bottom: 0, left: 0, opacity: 0, pointerEvents: 'none' }}
      />
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  return useContext(MusicPlayerContext);
}
  useEffect(() => {
    if (!ready || !videoId) return
    const id = setInterval(() => {
      const t = playerRef.current?.getCurrentTime?.()
      if (typeof t === 'number') setCurrentTime(t)
    }, 1000)
    return () => clearInterval(id)
  }, [ready, videoId])

  const play = useCallback((id, opts = {}) => {
    const p = playerRef.current
    if (!p || !ready) return
    if (id !== videoId) {
      p.loadVideoById(id, opts.startSeconds || 0)
      setVideoId(id)
      setTitle(opts.title || '')
    } else if (opts.startSeconds != null) {
      p.seekTo(opts.startSeconds, true)
    }
    p.playVideo()
  }, [ready, videoId])

  const pause = useCallback(() => playerRef.current?.pauseVideo?.(), [])
  const resume = useCallback(() => playerRef.current?.playVideo?.(), [])
  const togglePlay = useCallback(() => {
    if (playing) pause()
    else resume()
  }, [playing, pause, resume])
  const seekTo = useCallback((s) => playerRef.current?.seekTo?.(s, true), [])
  const close = useCallback(() => {
    playerRef.current?.stopVideo?.()
    setVideoId(null)
    setTitle('')
    setPlaying(false)
  }, [])

  return (
    <MusicPlayerContext.Provider
      value={{ videoId, title, playing, ready, currentTime, play, pause, resume, togglePlay, seekTo, close }}
    >
      {children}
      <div
        id={CONTAINER_ID}
        style={{ position: 'fixed', width: 1, height: 1, bottom: 0, left: 0, opacity: 0, pointerEvents: 'none' }}
      />
    </MusicPlayerContext.Provider>
  )
}

export function useMusicPlayer() {
  return useContext(MusicPlayerContext)
}
