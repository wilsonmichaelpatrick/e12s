import React, { Component } from 'react';
import ReactAudioPlayer from 'react-audio-player';

class Footer extends Component {

  reactPlayerId = 0;
  constructor(props) {
    super(props);
    this.state = {
      songIsPlaying: (props.songURL)
    };
  }

  onClick(key) {
    this.props.scrollToSongCallback(key);
  }

  render() {
    if (this.props.songChange)
      this.reactPlayerId++;
    let reactAudioPlayer;

    if (this.props.songURL) {
      reactAudioPlayer =
        <div key={this.reactPlayerId}><ReactAudioPlayer
          src={this.props.active ? this.props.songURL : undefined}
          autoPlay
          controls
          controlsList="nodownload"
        /></div>;
    }
    else {
      reactAudioPlayer = <div key={this.reactPlayerId}><ReactAudioPlayer controls controlsList="nodownload" /></div>;
    }
    let infoString1 = "";
    if (this.props.songTitle && this.props.songArtist) {
      infoString1 = <small><button className="song-button" onClick={(e) => { this.onClick(this.props.songKey) }}>&ldquo;{this.props.songTitle}&rdquo; by {this.props.songArtist}</button></small>;
    }
    return (
      <div className="Footer" ref={(divElement) => this.divElement = divElement}>
        {reactAudioPlayer}
        {infoString1}
        <br></br>
        <br></br>
      </div>
    );
  }
}

export default Footer;
