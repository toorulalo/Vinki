import { createContext, useContext, useState } from 'react'

const MusicPlayerContext = createContext(null)

export function MusicPlayerProvider({ children }) {
  const [url, setUrl] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)

  return (
    <MusicPlayerContext.Provider value={{ url, setUrl, isPlaying, setIsPlaying, volume, setVolume }}>
      {children}
    </MusicPlayerContext.Provider>
  )
}

export function useMusicPlayer() { return useContext(MusicPlayerContext) }
