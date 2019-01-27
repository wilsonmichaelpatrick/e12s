import React, { Component } from 'react';
import './App.css';
import Scroller from './Scroller';
import Footer from './Footer';
import Uploader from './Uploader';
import Deleter from './Deleter';

class App extends Component {

  resetState = {
    songChange: true,
    songTitle: undefined,
    songArtist: undefined,
    songKey: undefined,
    songURL: undefined,
    showPost: false,
    showDelete: false,
    scrollToKey: undefined,
    scrollAnimation: false,
    urlRoot: undefined,
    songInfo: [],
    updateCount: undefined,
    plus: false
  };

  constructor(props) {
    super(props);

    this.state = this.resetState;
    // TODO CORNER CASE - if the first song has actually been deleted, the server should return... what?  If it can't actually
    // find it, it should find where it would have gone, right?
    setInterval(() => { console.log("Fetching update count"); this.fetchUpdateCount((this.state.songInfo.length > 0) ? this.state.songInfo[0].key : undefined) }, 5000);
  }

  onSongClicked(title, artist, key, url) {
    this.setState(previousState => {
      let newState = Object.assign({}, previousState);
      // New song, play it
      newState.songChange = true;
      newState.songTitle = title;
      newState.songArtist = artist;
      newState.songKey = key;
      newState.songURL = url;
      newState.scrollToKey = null;
      return newState;
    });
  }

  componentDidMount() {
    this.fetchSnapshot();
  }

  onPostClicked() {
    this.setState(previousState => {
      let newState = Object.assign({}, previousState);
      newState.songChange = true;
      newState.showPost = true;
      newState.showDelete = false;
      return newState;
    });
  }

  onDeleteClicked(title, artist, key) {
    this.setState(previousState => {
      let newState = Object.assign({}, previousState);
      newState.songChange = true;
      newState.songTitle = title;
      newState.songArtist = artist;
      newState.songKey = key;
      newState.songURL = undefined;
      newState.showPost = false;
      newState.showDelete = true;
      return newState;
    });
  }

  onMainClicked() {
    this.fetchSnapshot();
  }

  onScrollToSong(key) {
    this.setState(previousState => {
      let newState = Object.assign({}, previousState);
      newState.songChange = false;
      newState.scrollToKey = key;
      newState.scrollAnimation = true;
      return newState;
    });
  }

  setStateUploadingOrDeleting(is) {
    this.setState(previousState => {
      let newState = Object.assign({}, previousState);
      newState.isUploading = is;
      return newState;
    });
  }

  fetchMore(lastSongKey) {
    let requestBody = {
      key: lastSongKey
    };
    this.fetchData(requestBody);
  }

  fetchUpdateCount(lastSongKey) {
    let requestBody = {
      getUpdateCount: true,
      key: lastSongKey,
    };
    this.fetchData(requestBody);
  }

  fetchSnapshot() {
    this.setState(this.resetState, () => {
      this.fetchData({});
    });
  }

  fetchData(requestBody) {
    let fetchStatus;
    fetch("/read",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })
      .then(res => {
        fetchStatus = res.status;
        return res.json()
      })
      .then(
        (result) => {
          if (200 === fetchStatus) {
            this.setState(previousState => {
              let newState = Object.assign({}, previousState);
              newState.songChange = false;
              newState.scrollToKey = undefined;
              if (result.songInfo) {
                newState.urlRoot = result.urlRoot;
                newState.requestedSongKey = result.requestedSongKey;
                if (result.songInfo.length === 0) {
                  newState.noMore = true;
                } else {
                  newState.songInfo = newState.songInfo.concat(result.songInfo);
                }
              }
              else {
                newState.updateCount = result.updateCount;
                newState.plus = result.plus;
              }
              return newState;
            });
          }
          else {
            // Not much we can do if we can't fetch any data...
            console.error("Status " + fetchStatus + " returned for fetch");
          }
        },
        // Note: it's important to handle errors here
        // instead of a catch() block so that we don't swallow
        // exceptions from actual bugs in components.
        (error) => {
          // Not much we can do if we can't fetch any data...
          console.error(error);
        }
      )
  }

  onMoreClicked() {
    let lastSongKey = (this.state.songInfo.length > 0) ? this.state.songInfo[this.state.songInfo.length - 1].key : undefined;
    this.fetchMore(lastSongKey);
  }

  // TODO Preserve scroll position if we abandon a post or a delete
  render() {
    let updateString = "" + this.state.updateCount + (this.state.plus ? "+" : "") + " new songs available";
    let updateButton = (this.state.updateCount) ? <button className="song-button" onClick={(e) => { this.fetchSnapshot() }}>{updateString}</button> : "";
    let subHeader = (this.state.showPost || this.state.showDelete) ?
      (this.state.isUploading ? "" : <p><button className="header-button"
        onClick={(e) => { this.onMainClicked() }}>&nbsp;&nbsp;&larr; Back to the music</button></p>) :
      <p>{updateButton}</p>;
    let encodedHref = encodeURI(window.location.href);
    let facebookEncodedURI = "https://www.facebook.com/plugins/share_button.php?href=" + encodedHref + "&layout=button_count&size=small&mobile_iframe=true&width=87&height=20&appId";
    let facebookStyle = { border: "none", overflow: "hidden" };
    let faceBookButton = <iframe title="uniqueTitleProperty" src={facebookEncodedURI} width="87" height="20" style={facebookStyle} scrolling="no" frameBorder="0" allow="encrypted-media"></iframe>;
    let tumblrButton = <a className="tumblr-share-button" href="https://www.tumblr.com/share"> </a>;
    let twitterButton = <a className="twitter-share-button" href="https://twitter.com/intent/tweet"> </a>;
    let header = <div className="header"><h1>EPHEMERAL DEMOS</h1>{twitterButton} {tumblrButton} {faceBookButton} {subHeader}<hr></hr></div>;
    // We're using a fake header with the exact same content as the fixed header
    // to space the items on the rest of the page downward, so they're not obscured
    // behind the fixed header.  We're also leaving out the twitter and tumblr buttons
    // because they do not respect the hidden visibility on the div.
    let fakeheader = <div className="fakeheader"><h1>EPHEMERAL DEMOS</h1>{faceBookButton} {subHeader}<hr></hr></div>;

    return (
      <div className="App">
        {header}
        <div className={(this.state.showPost || this.state.showDelete) ? 'hidden' : 'main'}>
          {fakeheader}
          <p>Welcome to <b>EPHEMERAL DEMOS</b>, where original music resides for ~24 hours.</p>
          <p>Feel free to <button className="song-button" onClick={(e) => { this.onPostClicked() }}>post</button> any music that you own the rights to.</p>
          <p>Click the <button className="delete-button" onClick={(e) => { }}>&nbsp;&#x2691;&nbsp;</button> button next each song to remove any infringing or unacceptable content.</p>
          <br></br>
          <Scroller moreClickCallback={this.state.noMore ? undefined : () => this.onMoreClicked()}
            songInfo={this.state.songInfo} urlRoot={this.state.urlRoot} scrollToKey={this.state.scrollToKey} scrollAnimation={this.state.scrollAnimation}
            songClickCallback={(title, artist, key, url) => this.onSongClicked(title, artist, key, url)}
            deleteClickCallback={(title, artist, key) => this.onDeleteClicked(title, artist, key)} >
          </Scroller>
          <p>
            <small>What is the proper copyright for user-submitted material?</small>
          </p>
        </div>
        <div className={(this.state.showPost) ? 'main' : 'hidden'}>
          {fakeheader}
          <Uploader active={this.state.showPost} setStateUploading={(uploading) => { this.setStateUploadingOrDeleting(uploading); }}></Uploader>
        </div>
        <div className={(this.state.showDelete) ? 'main' : 'hidden'}>
          {fakeheader}
          <Deleter active={this.state.showDelete} url="/delete" setStateDeleting={(deleting) => { this.setStateUploadingOrDeleting(deleting); }} songKey={this.state.songKey} songArtist={this.state.songArtist} songTitle={this.state.songTitle}></Deleter>
        </div>
        <div className={(this.state.songURL && !(this.state.showPost || this.state.showDelete)) ? '' : 'hidden'}>
          <Footer active={!(this.state.showPost || this.state.showDelete)} songTitle={this.state.songTitle} songArtist={this.state.songArtist}
            songKey={this.state.songKey} songURL={this.state.songURL} songChange={this.state.songChange}
            scrollToSongCallback={(key) => this.onScrollToSong(key)} ></Footer>
        </div>
      </div>
    );
  }
}

export default App;
