import React, { Component } from 'react';

class Scroller extends Component {

  maybeScrollToKey() {
    if (this.props.scrollToKey && this.keyToRefMap) {
      let ref = this.keyToRefMap[this.props.scrollToKey];
      if (ref) {
        let scrollPosition = ref.offsetTop - (window.innerHeight / 2);
        if (scrollPosition < 0) scrollPosition = 0;
        window.scrollTo({
          top: scrollPosition,
          behavior: this.props.scrollAnimation ? "smooth" : undefined
        })
      }
    }
  }

  componentDidUpdate() {
    this.maybeScrollToKey();
  }

  componentDidMount() {
    this.maybeScrollToKey();
  }

  onSongClick(title, artist, key, url) {
    this.props.songClickCallback(title, artist, key, url);
  }

  onDeleteClick(title, artist, key) {
    this.props.deleteClickCallback(title, artist, key);
  }

  renderSongs(songInfo, urlRoot) {
    this.keyToRefMap = {};
    return songInfo.map((song) => {
      let url = urlRoot + "/" + song.timestamp + song.key + ".mp3";
      return (
        <div className="scrolleritem" key={song.key}>
          <hr width="100%"></hr>
          <div className="right">
            <button className="delete-button" onClick={(e) => { this.onDeleteClick(song.title, song.artist, song.key) }}>&nbsp;&nbsp;&#x2691;&nbsp;&nbsp;</button>
          </div>
          <br />&nbsp;
          <div ref={(ref) => { this.keyToRefMap[song.key] = ref; }}>
            <p> &ldquo;<button className="song-button" onClick={(e) => { this.onSongClick(song.title, song.artist, song.key, url) }}>{song.title}</button>&rdquo;</p>
            <p><i><small>by</small></i></p>
            <p>{song.artist}</p>
          </div>
          <br />&nbsp;
        <br />&nbsp;
        </div>
      )
    })
  }

  render() {
    let content = <p>Loading...</p>;
    let moreButton = "";
    if (this.props.moreClickCallback) {
      moreButton = <p><button className="song-button" onClick={(e) => { this.props.moreClickCallback() }}>More...</button></p>
    }
    if (this.props.songInfo && this.props.urlRoot) {
      content = this.renderSongs(this.props.songInfo, this.props.urlRoot);
    }
    return (
      <div className="Scroller">
        {content}
        <hr width="100%"></hr>
        {moreButton}
      </div>
    );
  }
}

export default Scroller;
