module.exports = function (test) {
    const path = require('path');
    const uuidv4 = require('uuid/v4');
    const base64 = require('uuid-base64');
    const http = require('http');
    const firebaseAdmin = require('firebase-admin');
    const { Storage } = require('@google-cloud/storage');
    var ID3v1 = require('id3v1-parser');
    var ID3v2 = require('id3v2-parser');
    var serverRequest = require('request');
    var fs = require('fs');

    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.jpeg': 'image/jpg',
        '.gif': 'image/gif',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        //'.svg': 'application/image/svg+xml'
        '.svg': "image/svg+xml",
        '.wasm': "application/wasm"
    };

    // Private instance data (enclosed by the constructor)
    const firebaseChunkSize = 5; // 100;
    const fileExt = '.mp3';
    const fileContentType = mimeTypes[fileExt];
    const appEngineProjectId = process.env.GOOGLE_CLOUD_PROJECT;
    const captchaSecretKey = process.env.CAPTCHA_SECRET_KEY;
    const bucketName = appEngineProjectId + '.appspot.com';
    const maxQueryDataTime = 10000;
    const maxQueryDataLen = 1024 * 1024;
    // TODO Need big tests for these next three:
    const maxPostDataLen = 1024 * 1024 * 20;
    const maxPostDataTime = 5 * 60000;
    const maxUploadPendingTime = 30000;
    let fileServerCache = {};
    let songInfoCache = [];
    let bucket;
    let firebaseSongsRef;
    let firebasePendingRef;

    function doInitializations() {
        const firebaseDatabaseURL = "https://" + appEngineProjectId + ".firebaseio.com";
        firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.applicationDefault(),
            databaseURL: firebaseDatabaseURL,
            projectId: appEngineProjectId,
            storageBucket: bucketName
        });
        const maxCacheSize = 100;
        const database = firebaseAdmin.database();
        firebasePendingRef = database.ref('pending');
        firebaseSongsRef = database.ref('songs');
        firebaseSongsRef.limitToLast(100).on('child_removed', (snapshot) => {
            binaryReverseArrayOperation(songInfoCache, snapshot, (array, object, index, found) => {
                if (found)
                    array.splice(index, 1);
            });
        });

        let previousKeyReceived = null;
        firebaseSongsRef.limitToLast(firebaseChunkSize).on('child_added', (snapshot, prevChildKey) => {
            if (previousKeyReceived && previousKeyReceived >= snapshot.key) {
                // Someone is late to the party... figure out where they go
                binaryReverseArrayOperation(songInfoCache, {
                    key: snapshot.key,
                    title: snapshot.val().title,
                    artist: snapshot.val().artist,
                    timestamp: snapshot.val().timestamp
                }, (array, object, index, found) => {
                    if (!found)
                        array.splice(index, 0, object);
                });
            }
            else {
                // In-order arrival, just push it into the array
                previousKeyReceived = snapshot.key;
                songInfoCache.unshift({
                    key: snapshot.key,
                    title: snapshot.val().title,
                    artist: snapshot.val().artist,
                    timestamp: snapshot.val().timestamp
                });
            }
            if (songInfoCache.length > maxCacheSize) {
                songInfoCache.splice(maxCacheSize, songInfoCache.length - maxCacheSize);
            }
        });

        // Cloud storage
        const storage = new Storage({
            projectId: appEngineProjectId,
        });

        bucket = storage.bucket(bucketName);
    }

    function logString(s) { console.log((new Date()).getTime() + " LOG " + s); }
    function errString(s) { console.error((new Date()).getTime() + " ERR " + s); }

    function binaryReverseArrayOperation(A, T, func) {
        let L = 0;
        let R = A.length - 1;
        while (L <= R) {
            let m = Math.floor((L + R) / 2)
            if (A[m].key > T.key)
                L = m + 1;
            else if (A[m].key < T.key)
                R = m - 1;
            else {
                func(A, T, m, true); // Found
                return;
            }
        }
        func(A, T, L, false); // Not found
    }

    // Server methods
    function getFilename(timestamp, pushKey) {
        return "" + timestamp + pushKey + fileExt;
    }

    function sendSuccessResponseWithFileContent(request, response, contentType, mtime, content, debugString) {
        if (debugString)
            logString(debugString);
        request.pause(); // ??? Is this right?  If not, how do we stop the client from sending more data?
        // NOPE... this causes a 500... I guess we trust Node.js to do this implicitly... request.destroy();
        response.writeHead(200, {
            'Content-Type': contentType,
            "Last-Modified": mtime,
            "Cache-Control": "max-age=0"
        });
        response.end(content, 'utf-8');
    }

    function sendSuccessResponseWithJSONObject(request, response, object, debugString) {
        if (debugString)
            logString("Sending 200 response: " + debugString);
        request.pause(); // ??? Is this right?  If not, how do we stop the client from sending more data?
        // NOPE... this causes a 500... I guess we trust Node.js to do this implicitly... request.destroy();
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(object), 'utf-8');
    }

    function sendFailResponse(request, response, debugString) {
        if (debugString)
            errString("Sending 500 response: " + debugString);
        request.pause(); // ??? Is this right?  If not, how do we stop the client from sending more data?
        // NOPE... this causes a 500... I guess we trust Node.js to do this implicitly... request.destroy();
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({}), 'utf-8');
    }

    // Calling this seems to result in an automatic
    // 500 response, so presumably the caller doesn't
    // need to do anything with the response object afterward
    function squashRequest(request, reason) {
        if (reason)
            errString("Destroying request: " + reason);
        request.pause();
        request.destroy();
        request.connection.destroy();
    }

    // It's tempting to just...
    // request.pipe(gcsStream);
    // ...but then we can end up with the file in storage before
    // we validate it, which means we have to go back and delete it.
    // Also for small enough files it might already have buffered
    // all the data at the time we try to fail things, so when we 
    // call destroy on the GCS stream, we get a close event,
    //  ***and then we get a finish event after that*** which
    // means our failure and success handling BOTH happen AND
    // we have to delete the file.  This has been seen to happen.
    // So... let's just feed the GCS stream manually and wait
    // for our validation to complete before we end or destroy it
    // at the last step.
    // Doing the validation and the store concurrently comes at
    // a price in complexity :)
    function processCreate(request, response) {
        // Validation info
        const postDataTime = (new Date()).getTime();
        const ID3v1Parser = request.pipe(new ID3v1());
        const ID3v2Parser = request.pipe(new ID3v2());
        let artist, title, comment;
        let validationSuccess, validationFinished;

        // GCS Stream info
        const newPostRef = firebaseSongsRef.push();
        const pushKey = newPostRef.key;
        const filenameTimestamp = Math.round(new Date().getTime() / 1000); // Compare to filenameTimestamp + (24 * 60 * 60) for expiry
        const gcsFile = bucket.file(getFilename(filenameTimestamp, pushKey));
        const gcsStream = gcsFile.createWriteStream({ metadata: { contentType: fileContentType } });
        let gcsReadSuccess, gcsReadFinished;
        let gcsResponseSent = false;

        // The other concern...
        let requestDataLength = 0;

        function maybeFinish() {
            if (validationFinished && gcsReadFinished) {
                if (validationSuccess && gcsReadSuccess) {
                    logString("gcsStream.end()");
                    gcsStream.end();
                }
                else {
                    errString("gcsStream.destroy()");
                    gcsStream.destroy();
                }
            }
        }

        function validationBailOut(errString) {
            squashRequest(request, "Bailout: " + errString);
            gcsResponseSent = true; // Squashing the request seems to result in an automatic 500 response
            validationFinished = true;
            maybeFinish();
        }

        // There should be no ID3v2 data at all.
        ID3v2Parser.on('data', (tag) => { validationBailOut("Unexpected ID3v2 tag " + tag.type); });
        // An ID3v2 error is actually expected, as there should be no tags.
        ID3v2Parser.on('error', () => { /* validationBailOut("BOGUS ID3v2Parser.on('error' "); */ });
        ID3v2Parser.on('end', () => { logString("ID3v2Parser end for " + filenameTimestamp + pushKey); });
        // TODO Previously mpeg-frame-parser was used here to decode the actual MP3 frames but it
        // doesn't do any error reporting... we need something to validate the actual data, not
        // just the tags

        ID3v1Parser.on('data', (tag) => {
            let error = false;
            const upperCase = tag.type.toUpperCase();
            if (upperCase === 'TITLE') {
                if (title) error = true;
                else title = tag.value.replace(/[^0-9a-z ]/gi, '');
                if (title.length === 0) title = undefined;
            }
            else if (upperCase === 'ARTIST') {
                if (artist) error = true;
                else artist = tag.value.replace(/[^0-9a-z ]/gi, '');
                if (artist.length === 0) artist = undefined;
            }
            else if (upperCase === 'COMMENT') {
                // The comment is a base64-encoded UUID,
                // so don't apply the regex!
                if (comment) error = true;
                else comment = tag.value;
            }
            else if (tag.type.toUpperCase() === 'ALBUM' || tag.type.toUpperCase() === 'YEAR') { error = (tag.value !== ''); }
            else if (tag.type.toUpperCase() === 'TRACK' || tag.type.toUpperCase() === 'GENRE') { error = (tag.value !== 0); }
            else { error = true; }

            if (error)
                validationBailOut("Unexpected ID3v1 tag " + tag.type);
        });
        ID3v1Parser.on('error', () => { validationBailOut("ID3v1 error"); });
        ID3v1Parser.on('end', () => {
            logString("ID3v1Parser end for " + filenameTimestamp + pushKey);
            if (validationFinished)
                return; // We must have already failed
            const uploadToken = comment && base64.decode(comment);
            if (artist && title && comment && uploadToken) {
                firebasePendingRef.child(uploadToken).once('value').then((snapshot) => {
                    const uploadStartTimestamp = snapshot.val() && snapshot.val().timestamp;
                    if (!uploadStartTimestamp) {
                        errString("No matching upload timestamp or timestamp expired for " + filenameTimestamp + pushKey);
                    }
                    else {
                        const timeDiff = (new Date().getTime()) - uploadStartTimestamp;
                        if (timeDiff > maxUploadPendingTime) {
                            errString("Maximum time lag on upload exceeded, " + timeDiff + ">" + maxUploadPendingTime +
                                " for " + filenameTimestamp + pushKey);
                        }
                        else validationSuccess = true;
                    }
                    validationFinished = true;
                    maybeFinish();
                }).catch((e) => {
                    errString("Error " + e + " saving upload token to firebase.");
                    validationFinished = true;
                    maybeFinish();
                });
            } else {
                errString("Missing one or more of artist/title/comment/uploadToken");
                validationFinished = true;
                maybeFinish();
            }
        });

        gcsStream.on('error', (err) => {
            logString("gcsStream error for " + filenameTimestamp + pushKey);
            if (!gcsResponseSent)
                sendFailResponse(request, response, "gcsStream error for " + filenameTimestamp + pushKey);
            gcsResponseSent = true;
        });
        gcsStream.on('close', (err) => {
            logString("gcsStream close for " + filenameTimestamp + pushKey);
            if (!gcsResponseSent)
                sendFailResponse(request, response, "gcsStream close for " + filenameTimestamp + pushKey);
            gcsResponseSent = true;
        });
        gcsStream.on('finish', () => {
            logString("gcsStream finish for " + filenameTimestamp + pushKey);
            // N.B. If we've ended up here, we must have succeeded in every other aspect otherwise
            // gcsStream.destroy() would have been called instead of gcsStream.end()
            if (!gcsResponseSent) {
                gcsResponseSent = true; // Well, not quite yet, but it's necessary to stop the other cases
                gcsFile.makePublic().then(() => {
                    logString("gcsStream public for " + filenameTimestamp + pushKey);
                    newPostRef.set({ title: title, artist: artist, timestamp: filenameTimestamp, },
                        (error) => {
                            if (error) {
                                sendFailResponse(request, response, "Failed to set firebase information for " +
                                    filenameTimestamp + pushKey + "with error" + error);
                            } else {
                                sendSuccessResponseWithJSONObject(request, response, {}, "Upload success for " +
                                    filenameTimestamp + pushKey);
                            }
                        });
                }).catch((e) => {
                    sendFailResponse(request, response, "gcsFile " + e + " failed to set public access for " +
                        filenameTimestamp + pushKey);
                });
            }
        });

        request.on('data', function (data) {
            requestDataLength += data.length;
            const currentTime = (new Date()).getTime();
            if (((currentTime - postDataTime) > maxPostDataTime) || (currentTime - postDataTime < 0)) {
                validationBailOut("Exceeded maxPostDataTime for " + filenameTimestamp + pushKey);
            }
            else if (requestDataLength > maxPostDataLen) {
                validationBailOut("Exceeded maxPostDataLen for " + filenameTimestamp + pushKey);
            }
            else if (!gcsReadFinished) {
                if (!gcsStream.write(data)) {
                    request.pause();
                    gcsStream.once('drain', () => { request.resume(); });
                }
            }
            else {
                validationBailOut("Unexpected post-finish data for " + filenameTimestamp + pushKey);
            }
        });
        request.on('close', function (data) {
            errString("request close for " + filenameTimestamp + pushKey);
            if (!gcsReadFinished) {
                gcsReadFinished = true;
                maybeFinish();
            }
        });
        request.on('error', function (data) {
            errString("request error for " + filenameTimestamp + pushKey);
            if (!gcsReadFinished) {
                gcsReadFinished = true;
                maybeFinish();
            }
        });
        request.on('end', function () {
            logString("request end for " + filenameTimestamp + pushKey);
            if (!gcsReadFinished) {
                gcsReadFinished = true;
                gcsReadSuccess = true;
                maybeFinish();
            }
        });
    }

    function handleCreate(request, response) {
        if (request.method == 'POST') {
            const contentType = request.headers && request.headers['content-type'];
            if (contentType !== fileContentType) {
                sendFailResponse(request, response, 'Request has incorrect content type ' + contentType);
            }
            else {
                processCreate(request, response);
            }
        }
        else
            sendFailResponse(request, response, 'Incorrect method');
    }

    function handleFileRequest(request, response) {
        let filePath = path.normalize(request.url);
        var filteredfilePath = filePath.replace(/[^\./0-9a-z ]/gi, '');
        if (filteredfilePath !== filePath || filePath.includes("..")) {
            sendFailResponse(request, response, 'File path error: ' + request.url);
        }
        else {
            filePath = './build' + (filePath.charAt(0) === '/' ? '' : '/') + filePath;
            if (filePath === './build/' || filePath === './build/.')
                filePath = './build/index.html';
            console.log("file " + filePath + " requested")
            const extname = String(path.extname(filePath)).toLowerCase();
            const contentType = mimeTypes[extname] || 'application/octet-stream';

            fs.stat(filePath, (err, stats) => {
                if (err || !stats) {
                    sendFailResponse(request, response, 'File error: ' + err);
                }
                else {
                    const mtime = stats.mtime && stats.mtime.toUTCString();
                    const { headers } = request;
                    const ifModifiedHeader = headers && headers['if-modified-since'];
                    let cachedContentAndTime = fileServerCache[filePath];

                    if (!mtime || !cachedContentAndTime || cachedContentAndTime.time != mtime) {
                        cachedContentAndTime = undefined; // Not the same version, can't use cache
                    }

                    if (mtime && ifModifiedHeader && (ifModifiedHeader === mtime)) {
                        response.writeHead(304);
                        response.end();
                    }
                    else if (cachedContentAndTime) {
                        sendSuccessResponseWithFileContent(request, response, contentType, mtime, cachedContentAndTime.content, undefined);
                    }
                    else {
                        fs.readFile(filePath, (error, content) => {
                            if (error) {
                                sendFailResponse(request, response, 'File error: ' + error.code);
                            }
                            else {
                                sendSuccessResponseWithFileContent(request, response, contentType, mtime, content, undefined);
                                if (mtime && content) {
                                    fileServerCache[filePath] = { content: content, time: mtime };
                                }
                            }
                        });
                    }
                }
            })
        }
    }

    function createCaptchaURL(captchaResponse, remoteAddress) {
        const captchaURL = "https://www.google.com/recaptcha/api/siteverify?secret=" +
            captchaSecretKey + "&response=" + captchaResponse + "&remoteip=" + remoteAddress;
        return captchaURL;
    }

    function checkCaptcha(captchaResponse, remoteAddress) {
        return new Promise((resolve, reject) => {
            if (captchaResponse) {
                const captchaURL = createCaptchaURL(captchaResponse, remoteAddress);
                serverRequest(captchaURL, (captchaError, captchaResponse, captchaBody) => {
                    const responseInfo = captchaBody ? JSON.parse(captchaBody) : undefined;
                    const captchaSuccess = responseInfo ? responseInfo.success : undefined;
                    if (captchaSuccess) { resolve(); }
                    else { reject("Captcha validation returned success=false"); }
                });
            }
            else { reject("Captcha validation missing response"); }
        });
    }

    function handleVerify(request, response) {
        let dataBytes = 0;
        let queryData = "";
        let queryDataTime = (new Date()).getTime();
        request.on('data', (data) => {
            queryData += data;
            dataBytes += data.length;
            const currentTime = (new Date()).getTime();
            if (((currentTime - queryDataTime) > maxQueryDataTime) || (currentTime - queryDataTime < 0)) {
                squashRequest(request, "Exceeded maxQueryDataTime for upload captcha");
            }
            else if (dataBytes > maxQueryDataLen) {
                squashRequest(request, "Exceeded maxQueryDataLen for upload captcha");
            }
        });

        request.on('end', () => {
            const uploadToken = uuidv4();
            const responseData = { uploadUUID: base64.encode(uploadToken) }
            const queryJSON = queryData ? JSON.parse(queryData) : undefined;
            const captchaResponse = queryJSON ? queryJSON["g-recaptcha-response"] : undefined;
            const captchaPromise = checkCaptcha(captchaResponse, request.connection.remoteAddress);
            const uploadTokenPromise = new Promise((resolve, reject) => {
                firebasePendingRef.child(uploadToken).set({
                    timestamp: new Date().getTime()
                }, (error) => {
                    if (error) { reject("Firebase could not add uploadToken " + error); }
                    else { resolve(); }
                });
            });
            Promise.all([captchaPromise, uploadTokenPromise])
                .then((values) => {
                    sendSuccessResponseWithJSONObject(request, response, responseData, "Verify success");
                })
                .catch((error) => {
                    sendFailResponse(request, response, "Captcha/uploadToken error caught " + error);
                });
        });
    }

    function deleteFromFirebase(deleteSongRef, request, response, deleteKey) {
        deleteSongRef.remove((error) => {
            if (error) {
                sendFailResponse(request, response, 'Firebase failure deleting ' + deleteKey + " with " + error);
            }
            else {
                logString("Successfully deleted key " + deleteKey);
                let result = { success: true }
                sendSuccessResponseWithJSONObject(request, response, result, "Delete success");
            }
        });
    }

    function processDelete(request, response, queryData) {
        const queryJSON = queryData ? JSON.parse(queryData) : undefined;
        const deleteKey = queryJSON ? queryJSON["deleteKey"] : undefined;
        logString("Deleting key " + deleteKey);
        const captchaResponse = queryJSON && queryJSON["g-recaptcha-response"];
        checkCaptcha(captchaResponse, request.connection.remoteAddress).then(() => {
            const deleteSongRef = firebaseSongsRef.child(deleteKey);
            deleteSongRef.once('value').then((snapshot) => {
                const fileName = snapshot.val().timestamp + snapshot.key + fileExt;
                logString("Deleting key " + deleteKey + " filename is " + fileName);
                bucket.file(fileName).delete().then((data) => {
                    logString("Deleted " + fileName + " from storage for key " + deleteKey);
                    deleteFromFirebase(deleteSongRef, request, response, deleteKey);
                }).catch((e) => {
                    // sendFailResponse(request, response, 'Cloud storage failure deleting ' + deleteKey);
                    errString("Cloud storage error caught " + e + " deleting " + deleteKey);
                    // Let's delete it from firebase anyway
                    deleteFromFirebase(deleteSongRef, request, response, deleteKey);
                });
            }).catch((e) => {
                sendFailResponse(request, response, "Exception caught - could not get firebase info for " + deleteKey + " " + e);
            });
        }).catch((e) => {
            // If database.ref throws before we get to the deleteSongRef.once promise we can
            // end up here even if the captcha worked.
            sendFailResponse(request, response, "Caught captcha or firebase ref failure " + e + " deleting " + deleteKey);
        });
    }

    function handleDelete(request, response) {
        let dataBytes = 0;
        let queryData = "";
        const queryDataTime = (new Date()).getTime();
        request.on('data', (data) => {
            queryData += data;
            dataBytes += data.length;
            const currentTime = (new Date()).getTime();
            if (((currentTime - queryDataTime) > maxQueryDataTime) || (currentTime - queryDataTime < 0)) {
                squashRequest(request, "Exceeded maxQueryDataTime for delete captcha");
            }
            else if (dataBytes > maxQueryDataLen) {
                squashRequest(request, "Exceeded maxQueryDataLen for delete captcha");
            }
        });
        request.on('end', () => {
            processDelete(request, response, queryData);
        });
    }

    function processRead(request, response, queryData) {
        const queryJSON = queryData ? JSON.parse(queryData) : undefined;
        const readKey = queryJSON ? queryJSON["key"] : undefined;
        const getUpdateCount = queryJSON ? queryJSON["getUpdateCount"] : undefined;

        if (getUpdateCount) {
            let plus = false;
            let updateCount = 0;
            // Just use queryJSON directly since it has a key
            if (!queryJSON || !(queryJSON.key)) {
                updateCount = songInfoCache.length;
                plus = (songInfoCache.length >= firebaseChunkSize);
            }
            else {
                binaryReverseArrayOperation(songInfoCache, queryJSON, (array, object, index, found) => {
                    if (found)
                        updateCount = index;
                    else {
                        updateCount = songInfoCache.length;
                        plus = true;
                    }
                });
            }
            const responseData =
            {
                updateCount: updateCount,
                plus: plus
            };
            sendSuccessResponseWithJSONObject(request, response, responseData, undefined);
        }
        else if (readKey) {
            {
                const songInfo = [];
                var requestedKeyFound = false;
                firebaseSongsRef.orderByKey().endAt(readKey).limitToLast(firebaseChunkSize).once('value', (querySnapshot) => {
                    querySnapshot.forEach((snapshot) => {
                        requestedKeyFound = requestedKeyFound || (readKey === snapshot.key);
                        songInfo.unshift({
                            key: snapshot.key,
                            title: snapshot.val().title,
                            artist: snapshot.val().artist,
                            timestamp: snapshot.val().timestamp
                        });
                    });
                    if (requestedKeyFound && songInfo.length > 0)
                        songInfo.shift(); // The key used in the request is one the client already has, so don't send it again.
                    const responseData =
                    {
                        urlRoot: 'https://storage.googleapis.com/' + bucketName,
                        songInfo: songInfo,
                        requestedSongKey: readKey
                    };
                    sendSuccessResponseWithJSONObject(request, response, responseData, undefined);
                },
                    (e) => { sendFailResponse(request, response, "Firebase read failure for key " + readKey) });
            }
        }
        else {
            const responseData =
            {
                urlRoot: 'https://storage.googleapis.com/' + bucketName,
                songInfo: songInfoCache
            };
            sendSuccessResponseWithJSONObject(request, response, responseData, undefined);
        }
    }

    function cleanupRemoveKey(ref, snapshot) {
        ref.child(snapshot.key).remove((error) => {
            if (error) {
                errString("Scheduled cleanup error " + error + " removing entry for key=" + snapshot.key + " timestamp=" +
                    snapshot.val().timestamp + " title=" + snapshot.val().title + " artist=" + snapshot.val().artist);
            }
            else {
                logString("Scheduled cleanup removed entry for key=" + snapshot.key + " timestamp=" + snapshot.val().timestamp +
                    " title=" + snapshot.val().title + " artist=" + snapshot.val().artist);
            }
        });
    }

    function handleClean(request, response) {
        const pendingCutoffTime = ((new Date()).getTime()) - maxUploadPendingTime;
        firebasePendingRef.orderByChild('timestamp').endAt(pendingCutoffTime).once('value', (querySnapshot) => {
            querySnapshot.forEach((snapshot) => {
                logString("Scheduled cleanup about to pending upload key=" + snapshot.key + " timestamp=" + snapshot.val().timestamp);
                cleanupRemoveKey(firebasePendingRef, snapshot);
            });
        });
        const cutoffTime = ((new Date()).getTime() / 1000) - 24 * 60 * 60;
        firebaseSongsRef.orderByChild('timestamp').endAt(cutoffTime).once('value', (querySnapshot) => {
            querySnapshot.forEach((snapshot) => {
                logString("Scheduled cleanup about to remove key=" + snapshot.key + " timestamp=" + snapshot.val().timestamp +
                    " title=" + snapshot.val().title + " artist=" + snapshot.val().artist);
                const fileName = snapshot.val().timestamp + snapshot.key + fileExt;
                bucket.file(fileName).delete().then((data) => {
                    logString("Scheduled cleanup removed file for key=" + snapshot.key + " timestamp=" + snapshot.val().timestamp +
                        " title=" + snapshot.val().title + " artist=" + snapshot.val().artist);
                    cleanupRemoveKey(firebaseSongsRef, snapshot);
                }).catch((e) => {
                    errString("Scheduled cleanup error " + e + " removing file for key=" + snapshot.key + " timestamp=" + snapshot.val().timestamp +
                        " title=" + snapshot.val().title + " artist=" + snapshot.val().artist);
                    cleanupRemoveKey(firebaseSongsRef, snapshot);
                });
            });
        });
        sendSuccessResponseWithJSONObject(request, response, {}, undefined);
    }

    function handleRead(request, response) {
        let dataBytes = 0;
        let queryData = "";
        const queryDataTime = (new Date()).getTime();
        request.on('data', (data) => {
            queryData += data;
            dataBytes += data.length;
            const currentTime = (new Date()).getTime();
            if (((currentTime - queryDataTime) > maxQueryDataTime) || (currentTime - queryDataTime < 0)) {
                squashRequest(request, "Exceeded maxQueryDataTime for read");
            }
            else if (dataBytes > maxQueryDataLen) {
                squashRequest(request, "Exceeded maxQueryDataLen for read");
            }
        });
        request.on('end', () => {
            processRead(request, response, queryData);
        });
    }

    if (test) {
        // Make the private methods available and allow state to be set for testing.
        this.handleRead = handleRead;
        this.handleClean = handleClean;
        this.cleanupRemoveKey = cleanupRemoveKey;
        this.processRead = processRead;
        this.handleDelete = handleDelete;
        this.processDelete = processDelete;
        this.deleteFromFirebase = deleteFromFirebase;
        this.handleVerify = handleVerify;
        this.checkCaptcha = checkCaptcha;
        this.handleFileRequest = handleFileRequest;
        this.handleCreate = handleCreate;
        this.processCreate = processCreate;
        this.squashRequest = squashRequest;
        this.sendFailResponse = sendFailResponse;
        this.sendSuccessResponseWithJSONObject = sendSuccessResponseWithJSONObject;
        this.sendSuccessResponseWithFileContent = sendSuccessResponseWithFileContent;
        this.getFilename = getFilename;
        this.binaryReverseArrayOperation = binaryReverseArrayOperation;
        this.setStateForTest = function (fileServerCache_, songInfoCache_, bucket_, firebaseSongsRef_, firebasePendingRef_,
            ID3v1_, ID3v2_, Frames_, serverRequest_, fs_) {
            fileServerCache = fileServerCache_;
            songInfoCache = songInfoCache_;
            bucket = bucket_;
            firebaseSongsRef = firebaseSongsRef_;
            firebasePendingRef = firebasePendingRef_;
            ID3v1 = ID3v1_;
            ID3v2 = ID3v2_;
            Frames = Frames_;
            serverRequest = serverRequest_;
            fs = fs_;
        }
        this.maxQueryDataLen = maxQueryDataLen;
        this.maxQueryDataTime = maxQueryDataTime;
    }
    else {
        doInitializations();
        this.run = () => {
            const httpServer = http.createServer((request, response) => {
                if (request.url == '/verify') {
                    handleVerify(request, response);
                }
                else if (request.url == '/create') {
                    handleCreate(request, response);
                }
                else if (request.url == '/read') {
                    handleRead(request, response);
                }
                else if (request.url == '/delete') {
                    handleDelete(request, response);
                }
                else if (request.url == '/clean') {
                    handleClean(request, response);
                }
                else {
                    handleFileRequest(request, response);
                }
            });

            httpServer.listen(process.env.PORT);
            logString("Server running on port " + process.env.PORT + "...")
        }
    }
}
