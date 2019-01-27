/* global wasmEncoder */
// The line above keeps the linter from complaining; we need a global
// variable to bootstrap the wasm.  See wasmEncoder below.
import React, { Component } from 'react';
import ReCAPTCHA from "react-google-recaptcha";

const recaptchaRef = React.createRef();

class Uploader extends Component {

  UploadState = {
    NONE: 0,
    PREPARING: 1,
    READING: 2,
    DECODING: 3,
    ENCODING: 4,
    UPLOADING: 5,
    FAILURE: 6,
    SUCCESS: 7
  };

  wasm = null;
  fileInputKey = 0;

  resetState = {
    uploadState: this.UploadState.NONE,
    songTitle: "",
    songArtist: "",
    songFiles: undefined
  };

  constructor(props) {
    super(props);
    this.state = this.resetState;
  }

  upload(uploadUUID) {
    this.props.setStateUploading(true);
    if (this.wasm) {
      this.fileChosenAndWasmLoaded(this.state.songFiles, uploadUUID);
    }
    else {
      this.setUploadState(this.UploadState.PREPARING);
      // Defined via emscripten command line -s MODULARIZE=1 -s 'EXPORT_NAME="wasmEncoder"'
      // and included in index.html via encoderwrapper.js
      wasmEncoder().then((Module) => {
        // this is reached when everything is ready, and you can call methods on Module
        console.log("wasmEncoder called")
        this.wasm = Module;
        this.fileChosenAndWasmLoaded(this.state.songFiles, uploadUUID);
      });
    }
  }

  onCaptchaChange(value) {
    this.setState(previousState => {
      let newState = Object.assign({}, previousState);
      newState.captchaValue = value;
      return newState;
    });
  }

  uploadClicked() {
    // Artist, title and filename are React-controlled and
    // we will pick them up out of the state.  The captcha
    // response needs to be dug out separately.
    const recaptchaValue = recaptchaRef.current.getValue();

    let fetchStatus;
    fetch('/verify', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ "g-recaptcha-response": recaptchaValue }),
    })
      .then(res => {
        fetchStatus = res.status;
        return res.json()
      })
      .then(
        (result) => {
          if (200 === fetchStatus) {
            console.log("result.uploadUUID is ", result.uploadUUID)
            this.upload(result.uploadUUID);
          }
          else {
            console.error("Failed to get uploadUUID");
            this.setUploadState(this.UploadState.FAILURE);
          }
        },
        (error) => {
          this.setUploadState(this.UploadState.FAILURE);
        }
      )
    recaptchaRef.current.reset();
  }

  setUploadState(uploadstate) {
    this.setState(previousState => {
      let newState = Object.assign({}, previousState);
      newState.uploadState = uploadstate;
      return newState;
    });
  }

  fileChosenAndWasmLoaded(files, uploadUUID) {
    let reader = new FileReader();
    // Q: Can readAsArrayBuffer and decodeAudioData be done with anything less
    // than the full file?  This is expensive, memory-wise.
    // A: PERHAPS NOT: 
    // https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData
    // "This method only works on complete file data, not fragments of audio file data."
    // Moreover the decoding probably can't be done with anything other than the browser's
    // existing functionality without creating licensing concerns.  There seems to be
    // no alternative to loading the file in one big chunk.
    reader.onerror = (event) => {
      console.log("Error reading audio data" + event);
      this.props.setStateUploading(false);
      this.setUploadState(this.UploadState.FAILURE);
    }
    reader.onload = (event) => {
      let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      let the_array_buffer = event.target.result;
      this.setUploadState(this.UploadState.DECODING);

      audioCtx.decodeAudioData(the_array_buffer, (audioBuffer) => {
        let sampleRate = audioBuffer.sampleRate;
        let numberOfChannels = audioBuffer.numberOfChannels;
        let title = this.state.songTitle;
        let artist = this.state.songArtist;
        let comment = uploadUUID;
        let ptrTitle = this.wasm.allocate(this.wasm.intArrayFromString(title), 'i8', this.wasm.ALLOC_NORMAL);
        let ptrArtist = this.wasm.allocate(this.wasm.intArrayFromString(artist), 'i8', this.wasm.ALLOC_NORMAL);
        let ptrComment = this.wasm.allocate(this.wasm.intArrayFromString(comment), 'i8', this.wasm.ALLOC_NORMAL);

        let samplesPerChunk = 1024 * 64;

        let input0 = audioBuffer.getChannelData(0);
        let input0C = this.wasm._malloc(samplesPerChunk * input0.BYTES_PER_ELEMENT);

        let input1 = audioBuffer.getChannelData(1);
        let input1C = this.wasm._malloc(samplesPerChunk * input1.BYTES_PER_ELEMENT);

        let outputMaxSize = this.wasm._get_encoded_max_size(samplesPerChunk);
        let outputC = this.wasm._malloc(outputMaxSize);
        // NOPE see below -> let outputJS = new Uint8Array(this.wasm.HEAPU8.buffer, outputC, outputMaxSize);

        let totalSamples = input0.length;

        let blobData = [];

        let encoder = this.wasm._encoder_init(sampleRate, numberOfChannels, ptrTitle, ptrArtist, ptrComment);

        let sampleOffset = 0;
        let bytesEncoded;

        let encodeNextChunk = () => {
          this.setUploadState(this.UploadState.ENCODING);
          let inputSamples = ((sampleOffset + samplesPerChunk) < totalSamples) ?
            samplesPerChunk : (totalSamples - sampleOffset);

          let input0JS = new Float32Array(this.wasm.HEAPU8.buffer, input0C, inputSamples);
          let input0Chunk = input0.subarray(sampleOffset, sampleOffset + inputSamples);
          input0JS.set(input0Chunk);

          let input1JS = new Float32Array(this.wasm.HEAPU8.buffer, input1C, inputSamples);
          let input1Chunk = input1.subarray(sampleOffset, sampleOffset + inputSamples);
          input1JS.set(input1Chunk);

          bytesEncoded = this.wasm._encoder_encode(encoder,
            input0C, inputSamples, input1C, inputSamples,
            outputC, outputMaxSize);

          // The array view on outputC has to be created here, rather than above,
          // because the memory might have grown resulting in a detached ArrayBuffer.  
          // https://github.com/kripken/emscripten/issues/6747
          let outputJS = new Uint8Array(this.wasm.HEAPU8.buffer, outputC, outputMaxSize);
          blobData.push(new Uint8Array(outputJS.subarray(0, bytesEncoded)));
          sampleOffset += samplesPerChunk;
          if (sampleOffset < totalSamples) {
            setTimeout(encodeNextChunk, 1);
          }
          else {
            bytesEncoded = this.wasm._encoder_finish(encoder, outputC, outputMaxSize);
            let finishJS = new Uint8Array(this.wasm.HEAPU8.buffer, outputC, outputMaxSize);
            blobData.push(new Uint8Array(finishJS.subarray(0, bytesEncoded)));

            let blob = new Blob(blobData, { type: 'audio/mpeg' });

            this.setUploadState(this.UploadState.UPLOADING);
            let req = new XMLHttpRequest();
            req.open("POST", "/create", true);
            req.onabort = (e) => { this.setUploadState(this.UploadState.FAILURE); };
            req.onerror = (e) => { this.setUploadState(this.UploadState.FAILURE); };
            req.onloadend = (e) => {
              if (200 === req.status)
                this.setUploadState(this.UploadState.SUCCESS);
              else
                this.setUploadState(this.UploadState.FAILURE);
              this.props.setStateUploading(false);
            };
            req.send(blob);

            this.wasm._encoder_close(encoder);
            this.wasm._free(outputC);
            this.wasm._free(input0C);
            this.wasm._free(input1C);
            this.wasm._free(ptrTitle);
            this.wasm._free(ptrArtist);
            this.wasm._free(ptrComment);
          }
        };

        encodeNextChunk();
      },

        function (e) {
          console.log("Error decoding audio data" + e);
          this.props.setStateUploading(false);
        });
    }

    this.setUploadState(this.UploadState.READING);
    reader.readAsArrayBuffer(files[0]);

    // Uncommenting the statement below, and then doing a
    // breakpoint-then-continue from the Chrome debugger,
    // results in the FileReader falling completely asleep. 
    // This might be a Chrome bug.
    // console.log("Called reader.readAsArrayBuffer");
  }

  handleTitleChange(title) {
    this.setState(previousState => {
      let newState = Object.assign({}, previousState);
      newState.songTitle = title.replace(/[^0-9a-z ]/gi, '');
      return newState;
    });
  }

  handleArtistChange(artist) {
    this.setState(previousState => {
      let newState = Object.assign({}, previousState);
      newState.songArtist = artist.replace(/[^0-9a-z ]/gi, '');
      return newState;
    });
  }

  handleFileChange(files) {
    this.setState(previousState => {
      let newState = Object.assign({}, previousState);
      newState.songFiles = files;
      return newState;
    });
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.active && !this.props.active) {
      this.setState(this.resetState);
    }
  }

  render() {
    let legalese = `
    TODO - LEGALESE
    `;

    let uploadStateString;
    switch (this.state.uploadState) {
      case this.UploadState.PREPARING: uploadStateString = "Preparing"; break;
      case this.UploadState.READING: uploadStateString = "Reading"; break;
      case this.UploadState.DECODING: uploadStateString = "Decoding"; break;
      case this.UploadState.ENCODING: uploadStateString = "Encoding"; break;
      case this.UploadState.UPLOADING: uploadStateString = "Uploading"; break;
      case this.UploadState.FAILURE: uploadStateString = "Failed"; break;
      case this.UploadState.SUCCESS: uploadStateString = "Upload Succeeded"; break;
      default: uploadStateString = ""; break;
    }

    let enableUpload = (this.state.songTitle.length > 0) && (this.state.songArtist.length > 0) && this.state.songFiles && this.state.captchaValue;
    let uploadButton;
    if (enableUpload)
      uploadButton = <p><button className="action-button" onClick={(e) => { this.uploadClicked() }}>Upload</button></p>
    else
      uploadButton = <p><button className="action-button-grey">Upload</button></p>

    return (
      <div className="Uploader">
        <div className={(this.state.uploadState === this.UploadState.NONE) ? '' : 'hidden'}>
          <div className="normal-text">
            <p>Please read and carefully consider the following:</p>
            <ul>
              <li><p>TODO - legalese - no cover songs, no samples, no &ldquo;fair use&rdquo; of anyone else's work, etc</p></li>
              <li><p>Once the song is posted, it will be public for ~24 hours, though anyone can delete it at any time.</p></li>
              <li><p>TODO - After the song is removed from the site, that does not mean it is removed from the universe.  There is little
              to prevent people from downloading and saving their own copy if they choose to do so, etc, etc.</p></li>
            </ul>
          </div>
          <br></br>
          <center>
            <table width="100%">
              <tbody width="100%">
                <tr>
                  <td width="50%"><p className="right">Title:&nbsp;&nbsp;</p></td>
                  <td width="50%"><p><input type="text" name="title" value={this.state.songTitle} onChange={(e) => this.handleTitleChange(e.target.value)} /></p></td>
                </tr>
                <tr>
                  <td width="50%"><p className="right">Artist:&nbsp;&nbsp;</p></td>
                  <td width="50%"><p><input type="text" name="artist" value={this.state.songArtist} onChange={(e) => this.handleArtistChange(e.target.value)} /></p></td>
                </tr>
                <tr>
                  <td width="50%"><p className="right">File:&nbsp;&nbsp;</p></td>
                  <td width="50%"><p><input key={this.fileInputKey} type="file" name="filename" onChange={(e) => this.handleFileChange(e.target.files)} /></p></td>
                </tr>
              </tbody>
            </table>
            <ReCAPTCHA
              ref={recaptchaRef}
              onChange={(value) => { this.onCaptchaChange(value); }}
              sitekey="CAPTCHA_SITEKEY"
            />
            {uploadButton}
            <br></br>
            <br></br>
          </center>
          <div className="normal-text">
            {legalese}
          </div>
        </div>
        <div className={(this.state.uploadState === this.UploadState.NONE) ? 'hidden' : ''}>
          <p></p>
          <p>{uploadStateString}</p>
          <div className={((this.state.uploadState === this.UploadState.SUCCESS) ||
            (this.state.uploadState === this.UploadState.FAILURE)) ? '' : 'hidden'}>
            Click &ldquo;Back to the music&rdquo; above to go back.
          </div>
        </div>
      </div>
    );
  }
}

export default Uploader;
