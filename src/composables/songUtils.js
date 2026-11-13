// meta del brano per feeder/streamer: viene salvata insieme ai chunk in cache
// (pagina Cache, TTL degli album preferiti via album_id)
export function playerMetaOf(song) {
  return { title: song.title, artist: song.artist ?? '', album: song.album ?? '', album_id: song.album_id };
}

// ordina (sul posto) i brani di un album per disco e poi per traccia; ritorna la lista
export function sortByDiscTrack(songs) {
  return songs.sort((a, b) => {
    if (a.disc_nr !== b.disc_nr) {
      return a.disc_nr - b.disc_nr;
    }
    return a.track_nr - b.track_nr;
  });
}
