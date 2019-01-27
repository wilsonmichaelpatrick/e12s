# e12s

This is a mostly working prototype for a project called e12s, which is shorthand for "EPHEMERAL DEMOS".

CAVEAT: This project is definitely under construction. Note that there is nothing substantial on the "master" branch; 
you are looking at development code.

The concept is to allow uploads of original music, which would reside on a website for 24 hours, then vanish.
The time-limited aspect is an exercise in making a virtue out of necessity; why incur ongoing storage costs for 
old data that is referenced less and less frequently?  Similarly, in order to avoid obligations managing
personally identifiable information, the idea is to simply not have any; i.e., anyone can upload anything.  On
the flip side of that, anyone can delete anything as well, with a one-flag-and-it's-gone moderation policy.

Having written the prototype, I'm not convinced the overhead of managing it is worthwhile.  As such it's not
deployed anyplace, and the code here remains in a "working prototype" state, with TODOs and a handful of known
issues.

## Technical Details

### Server
The server implementation is in the [server](server) subdirectory.

The server is written in Javascript and runs under Node.js directly (i.e. not via Express).

The essential parts of the implementation are in [server/e12s.js](server/e12s.js).  In this code,
the server accepts uploads, deletes, and queries for what music is available.  It makes use of 
Google Cloud Storage to store the music, and state is coordinated across server instances using Firebase.
It does ReCAPTCHA validation for upload/delete operations.

There is additional utility functionality for serving files if that cannot be done from a static location,
and to clean out expired material.

There are automated tests in the [server_spec](server_spec) directory.

The major TODO on the server side is how to validate the actual content of the uploaded MP3 files.  There is validation
on the tags, but the frames themselves are not yet being checked to make sure they're real audio and not some kind of
garbage.

### WebAssembly compilation of LAME MP3 encoder
The LAME MP3 encoder is being compiled to WebAssembly using Emscripten.  A build script
and wrapper code are in the [emscripten](emscripten) directory.
(Google for details on LAME MP3; I'm not sure what the official source of this is).
This is being used to transcode whatever the user wants to upload to a consistent MP3 format.
In the spirit of economy, the transcoding is done in the browser, on the client side, using
the client's CPU.

### Client
The client implementation is in the [client](client) subdirectory.  The essential files are

* [client/src/App.js](client/src/App.js)
* [client/src/Deleter.js](client/src/Deleter.js)
* [client/src/Footer.js](client/src/Footer.js)
* [client/src/Scroller.js](client/src/Scroller.js)
* [client/src/Uploader.js](client/src/Uploader.js)

The client is written in React, and makes use of the WebAssembly LAME MP3 encoder described above.
There are several TODOs in the code itself; other known TODOs include automated tests and UI
improvements for the upload/delete in-progress UI.

