const e12s = require('../../server/e12s.js');

// Some say that private methods should not be tested, but with basically
// everything here being private, this advice is being ignored.
// We'll make the private methods available for testing via a constructor
// flag, and use a setStateForTest method to set up the unit test context.

function firebaseRefMock() {
    this.once_callbacks = [];
    this.once_fail_callbacks = [];
    this.set_callback = undefined;
    this.orderByChild = function () { return this; };
    this.orderByKey = function () { return this; };
    this.endAt = function () { return this; };
    this.limitToLast = function () { return this; };
    this.child = function () { return this; };
    this.push = function () { return this; };
    this.set = function (value, cb) { this.setValue = value; if (cb) this.set_callback = cb; return this; };
    this.once = function (event, cbSuccess, cbFail) {
        if (cbFail) { this.once_fail_callbacks[event] = cbFail }
        if (cbSuccess) { this.once_callbacks[event] = cbSuccess; }
        return this;
    };
    this.remove = function (cb) { return this; }
};

function parserMock() {
    this.on_callbacks = [];
    this.on = function (event, callback) {
        this.on_callbacks[event] = callback;
    };
}

function cloudStreamMock() {
    this.on_callbacks = [];
    this.on = function (event, callback) {
        this.on_callbacks[event] = callback;
    };
    this.destroy = function () { }
    this.end = function () { }
}

function requestMock() {
    this.on_callbacks = [];
    this.on = function (event, callback) {
        this.on_callbacks[event] = callback;
    };
    this.pause = function () { }
    this.destroy = function () { }
    this.pipe = function () { }
    this.connection = { destroy: function () { } };
}

function bucketMock() {
    this.makePublic = function () { }
    this.file = function (filename) { this.filename = filename; return this; };
    this.delete = function () { return this; }
    this.createWriteStream = function () { }
}

function responseMock() {
    this.writeHead = function (status, object) { this.status = status; this.writeHeadObject = object; }
    this.end = function (content, encoding) { this.content = content; this.encoding = encoding; }
}

// snapshotMock also works for songInfo mock
function snapshotMock(key, title, artist, timestamp) {
    this.key = key;
    this.val = function () { return this; }
    this.title = title;
    this.artist = artist;
    this.timestamp = timestamp;
}

function ID3v1MockBoilerplate(ID3v1Mock) {
    ID3v1Mock.on_callbacks['data']({ type: 'title', value: 'SOME_TITLE_1' });
    ID3v1Mock.on_callbacks['data']({ type: 'artist', value: 'SOME_ARTIST_1' });
    ID3v1Mock.on_callbacks['data']({ type: 'comment', value: 'cJeSwcsCFiy.SKksgEZw.k' });
    ID3v1Mock.on_callbacks['end']();
}

function fsMock() {
    this.stat = function () { }
    this.readFile = function () { }
}

describe("handleFileRequest", function () {
    var theApp;
    var request;
    var response;
    var fs;

    beforeEach(function () {
        theApp = new e12s(true);
        request = new requestMock;
        response = new responseMock;
        fs = new fsMock;
    });

    it("Reads file from disk and gives 200 if same file is requested again with a different modified time", function (done) {
        var wasExpectedFilenameInStat = false;
        var wasExpectedFilenameInRead = false;
        var theDate = new Date();
        spyOn(fs, "stat").and.callFake(function (filename, callback) {
            wasExpectedFilenameInStat = (filename === './build/somescript.jssdfsdfs.sdfsdf');
            callback(undefined, {mtime:theDate});
        });
        spyOn(fs, "readFile").and.callFake(function (filename, callback) {
            wasExpectedFilenameInRead = (filename === './build/somescript.jssdfsdfs.sdfsdf');
            callback(undefined, "SOME FILE CONTENT OH SWEET SURFEIT");
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, undefined, fs);
        request.url = "somescript.jssdfsdfs.sdfsdf";
        theApp.handleFileRequest(request, response);
        expect(wasExpectedFilenameInStat).toBe(true);
        expect(wasExpectedFilenameInRead).toBe(true);
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 200).toBe(true);
            done();
        });
        request.headers = {};
        request.headers['if-modified-since'] = "12345";
        theApp.handleFileRequest(request, response);
    });

    it("Reads file from disk and gives 304 if same file is requested again", function (done) {
        var wasExpectedFilenameInStat = false;
        var wasExpectedFilenameInRead = false;
        var theDate = new Date();
        spyOn(fs, "stat").and.callFake(function (filename, callback) {
            wasExpectedFilenameInStat = (filename === './build/somescript.jssdfsdfs.sdfsdf');
            callback(undefined, {mtime:theDate});
        });
        spyOn(fs, "readFile").and.callFake(function (filename, callback) {
            wasExpectedFilenameInRead = (filename === './build/somescript.jssdfsdfs.sdfsdf');
            callback(undefined, "SOME FILE CONTENT OH SWEET SURFEIT");
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, undefined, fs);
        request.url = "somescript.jssdfsdfs.sdfsdf";
        theApp.handleFileRequest(request, response);
        expect(wasExpectedFilenameInStat).toBe(true);
        expect(wasExpectedFilenameInRead).toBe(true);
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 304).toBe(true);
            done();
        });
        request.headers = {};
        request.headers['if-modified-since'] = theDate.toUTCString();;
        theApp.handleFileRequest(request, response);
    });

    it("Reads file from disk and gives 200 success", function (done) {
        var wasExpectedFilenameInStat = false;
        var wasExpectedFilenameInRead = false;
        var theDate = new Date();
        spyOn(fs, "stat").and.callFake(function (filename, callback) {
            wasExpectedFilenameInStat = (filename === './build/somescript.js');
            callback(undefined, {mtime:theDate});
        });
        spyOn(fs, "readFile").and.callFake(function (filename, callback) {
            wasExpectedFilenameInRead = (filename === './build/somescript.js');
            callback(undefined, "SOME FILE CONTENT");
        });
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 200).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, undefined, fs);
        request.url = "somescript.js";
        theApp.handleFileRequest(request, response);
        expect(wasExpectedFilenameInStat).toBe(true);
        expect(wasExpectedFilenameInRead).toBe(true);
    });

    it("Reads file from disk if there is no mtime and fails if it is not found", function (done) {
        var wasExpectedFilenameInStat = false;
        var wasExpectedFilenameInRead = false;
        spyOn(fs, "stat").and.callFake(function (filename, callback) {
            wasExpectedFilenameInStat = (filename === './build/somescript.js');
            callback(undefined, {});
        });
        spyOn(fs, "readFile").and.callFake(function (filename, callback) {
            wasExpectedFilenameInRead = (filename === './build/somescript.js');
            callback({ code: "FILE NOT FOUND ERROR"}, undefined);
        });
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, undefined, fs);
        request.url = "somescript.js";
        theApp.handleFileRequest(request, response);
        expect(wasExpectedFilenameInStat).toBe(true);
        expect(wasExpectedFilenameInRead).toBe(true);
    });

    it("Treats empty string as index.html and fail if there are no stats", function (done) {
        var wasIndexHtml = false;
        spyOn(fs, "stat").and.callFake(function (filename, callback) {
            wasIndexHtml = (filename === './build/index.html');
            callback("stats error", undefined);
        });
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, undefined, fs);
        request.url = "";
        theApp.handleFileRequest(request, response);
        expect(wasIndexHtml).toBe(true);
    });

    it("Treats empty string as index.html and fail if stat fails", function (done) {
        var wasIndexHtml = false;
        spyOn(fs, "stat").and.callFake(function (filename, callback) {
            wasIndexHtml = (filename === './build/index.html');
            callback("magical error", undefined);
        });
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, undefined, fs);
        request.url = "";
        theApp.handleFileRequest(request, response);
        expect(wasIndexHtml).toBe(true);
    });

    it("Fails on a request including ..", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, undefined, fs);
        request.url = "../something";
        theApp.handleFileRequest(request, response);
    });

    it("Fails on a request including special characters", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, undefined, fs);
        request.url = "something123.##_";
        theApp.handleFileRequest(request, response);
    });
});

describe("handleClean", function () {
    var theApp;
    var request;
    var response;
    var firebasePendingRef;
    var firebaseSongsRef;
    var bucket;

    beforeEach(function () {
        theApp = new e12s(true);
        request = new requestMock;
        response = new responseMock;
        firebasePendingRef = new firebaseRefMock;
        firebaseSongsRef = new firebaseRefMock;
        bucket = new bucketMock;
    });

    it("Does the right thing when everything works", function (done) {
        var filesRemovedFromSongRef = 0;
        spyOn(firebasePendingRef, "remove").and.callFake(function (cb) {
            cb();
        });
        spyOn(firebasePendingRef, "once").and.callFake(function (event, cb) {
            cb([
                new snapshotMock("key1", "title1", "artist1", "timestamp1"),
                new snapshotMock("key2", "title2", "artist2", "timestamp2"),
                new snapshotMock("key3", "title3", "artist3", "timestamp3"),
                new snapshotMock("key4", "title4", "artist4", "timestamp4"),
            ]);
        });

        spyOn(firebaseSongsRef, "remove").and.callFake(function (cb) {
            cb();
            filesRemovedFromSongRef++;
            if (filesRemovedFromSongRef == 4) {
                done();
            }
        });
        spyOn(firebaseSongsRef, "once").and.callFake(function (event, cb) {
            cb([
                new snapshotMock("key5", "title5", "artist5", "timestamp5"),
                new snapshotMock("key6", "title6", "artist6", "timestamp6"),
                new snapshotMock("key7", "title7", "artist7", "timestamp7"),
                new snapshotMock("key8", "title8", "artist8", "timestamp8"),
            ]);
        });
        spyOn(bucket, "delete").and.callFake(() => {
            return new Promise((resolve, reject) => { resolve(); });
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, undefined, undefined, undefined, undefined, undefined);
        theApp.handleClean(request, response);
    });

    it("Does what it can when firebase removes fail but bucket succeeds", function (done) {
        var filesRemovedFromSongRef = 0;
        spyOn(firebasePendingRef, "remove").and.callFake(function (cb) {
            cb("firebase PENDING REF delete key failed!");
        });
        spyOn(firebasePendingRef, "once").and.callFake(function (event, cb) {
            cb([
                new snapshotMock("key1", "title1", "artist1", "timestamp1"),
                new snapshotMock("key2", "title2", "artist2", "timestamp2"),
                new snapshotMock("key3", "title3", "artist3", "timestamp3"),
                new snapshotMock("key4", "title4", "artist4", "timestamp4"),
            ]);
        });

        spyOn(firebaseSongsRef, "remove").and.callFake(function (cb) {
            cb("firebase delete SONGS REF key failed!");
            filesRemovedFromSongRef++;
            if (filesRemovedFromSongRef == 4) {
                done();
            }
        });
        spyOn(firebaseSongsRef, "once").and.callFake(function (event, cb) {
            cb([
                new snapshotMock("key5", "title5", "artist5", "timestamp5"),
                new snapshotMock("key6", "title6", "artist6", "timestamp6"),
                new snapshotMock("key7", "title7", "artist7", "timestamp7"),
                new snapshotMock("key8", "title8", "artist8", "timestamp8"),
            ]);
        });
        spyOn(bucket, "delete").and.callFake(() => {
            return new Promise((resolve, reject) => { resolve(); });
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, undefined, undefined, undefined, undefined, undefined);
        theApp.handleClean(request, response);
    });

    it("Does what it can when firebase removes fail and bucket fails", function (done) {
        var filesRemovedFromSongRef = 0;
        spyOn(firebasePendingRef, "remove").and.callFake(function (cb) {
            cb("firebase PENDING REF delete key failed!");
        });
        spyOn(firebasePendingRef, "once").and.callFake(function (event, cb) {
            cb([
                new snapshotMock("key1", "title1", "artist1", "timestamp1"),
                new snapshotMock("key2", "title2", "artist2", "timestamp2"),
                new snapshotMock("key3", "title3", "artist3", "timestamp3"),
                new snapshotMock("key4", "title4", "artist4", "timestamp4"),
            ]);
        });

        spyOn(firebaseSongsRef, "remove").and.callFake(function (cb) {
            cb("firebase delete SONGS REF key failed!");
            filesRemovedFromSongRef++;
            if (filesRemovedFromSongRef == 4) {
                done();
            }
        });
        spyOn(firebaseSongsRef, "once").and.callFake(function (event, cb) {
            cb([
                new snapshotMock("key5", "title5", "artist5", "timestamp5"),
                new snapshotMock("key6", "title6", "artist6", "timestamp6"),
                new snapshotMock("key7", "title7", "artist7", "timestamp7"),
                new snapshotMock("key8", "title8", "artist8", "timestamp8"),
            ]);
        });
        spyOn(bucket, "delete").and.callFake(() => {
            return new Promise((resolve, reject) => { reject(); });
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, undefined, undefined, undefined, undefined, undefined);
        theApp.handleClean(request, response);
    });
});

describe("handleCreate", function () {
    var theApp;
    var ID3v1 = function () { this.name = 'ID3v1'; };
    var ID3v2 = function () { this.name = 'ID3v2'; };
    var Frames = function () { this.name = 'Frames'; };
    var request;
    var response;
    var firebasePendingRef;
    var firebaseSongsRef;
    var bucket;
    var ID3v1Mock;
    var ID3v2Mock;
    var FramesMock;
    var gcsMock;

    beforeEach(function () {
        theApp = new e12s(true);
        request = new requestMock;
        response = new responseMock;
        firebasePendingRef = new firebaseRefMock;
        firebaseSongsRef = new firebaseRefMock;
        bucket = new bucketMock;
        ID3v1Mock = new parserMock();
        ID3v2Mock = new parserMock();
        FramesMock = new parserMock();
        gcsMock = new cloudStreamMock();
    });

    function requestBoilerplate(request) {
        request.method = 'POST';
        request.headers = {};
        request.headers['content-type'] = 'audio/mpeg';
    }

    it("Sends 200 on success when everything works", function (done) {
        requestBoilerplate(request);
        spyOn(bucket, 'makePublic').and.callFake(function () {
            // OK, fire a finish after a moment's time
            return new Promise((resolve, reject) => { resolve(); });
        });
        spyOn(gcsMock, 'end').and.callFake(function () {
            // OK, fire a finish after a moment's time
            setTimeout(() => { gcsMock.on_callbacks['finish'](); }, 100);
        });
        spyOn(firebaseSongsRef, "set").and.callFake(function (whatever, cb) {
            cb();
        });
        spyOn(firebasePendingRef, "once").and.callFake(function (cb) {
            return new Promise((resolve, reject) => { resolve(new snapshotMock("key1", "title1", "artist1", new Date().getTime())); });
        });
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 200).toBe(true);
            done();
        });
        spyOn(request, "pipe").and.callFake(function (parser) {
            if (parser.name === 'ID3v1')
                return ID3v1Mock;
            if (parser.name === 'ID3v2')
                return ID3v2Mock;
            if (parser.name === 'Frames')
                return FramesMock;
        });
        spyOn(bucket, "createWriteStream").and.callFake(function (parser) {
            return gcsMock;
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
        ID3v1MockBoilerplate(ID3v1Mock);
        request.on_callbacks['end']();
    });

    it("Sends 500 failure on bad tag information", function (done) {
        requestBoilerplate(request);
        spyOn(gcsMock, 'destroy').and.callFake(function () {
            // OK, fire a close after a moment's time
            setTimeout(() => { gcsMock.on_callbacks['close'](); }, 100);
        });
        spyOn(response, "end").and.callFake(function () {
            expect(gcsMock.destroy).toHaveBeenCalled();
            expect(response.status === 500).toBe(true);
            done();
        });
        spyOn(request, "pipe").and.callFake(function (parser) {
            if (parser.name === 'ID3v1')
                return ID3v1Mock;
            if (parser.name === 'ID3v2')
                return ID3v2Mock;
            if (parser.name === 'Frames')
                return FramesMock;
        });
        spyOn(bucket, "createWriteStream").and.callFake(function (parser) {
            return gcsMock;
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
        ID3v1Mock.on_callbacks['data']({ type: 'title', value: '*&(*&(&' });
        ID3v1Mock.on_callbacks['data']({ type: 'artist', value: '*&(*&(&' });
        ID3v1Mock.on_callbacks['data']({ type: 'comment', value: 'cJeSwcsCFiy.SKksgEZw.k' });
        ID3v1Mock.on_callbacks['end']();
        request.on_callbacks['end']();
    });

    it("Sends 500 on successful validation and makePublic, but failed firebase", function (done) {
        requestBoilerplate(request);
        spyOn(bucket, 'makePublic').and.callFake(function () {
            // OK, fire a finish after a moment's time
            return new Promise((resolve, reject) => { resolve(); });
        });
        spyOn(gcsMock, 'end').and.callFake(function () {
            // OK, fire a finish after a moment's time
            setTimeout(() => { gcsMock.on_callbacks['finish'](); }, 100);
        });
        spyOn(firebaseSongsRef, "set").and.callFake(function (whatever, cb) {
            cb("SOME KIND OF ERROR IN SETTING FIREBASE INFO FOR UPLOADED SONG");
        });
        spyOn(firebasePendingRef, "once").and.callFake(function (cb) {
            return new Promise((resolve, reject) => { resolve(new snapshotMock("key1", "title1", "artist1", new Date().getTime())); });
        });
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        spyOn(request, "pipe").and.callFake(function (parser) {
            if (parser.name === 'ID3v1')
                return ID3v1Mock;
            if (parser.name === 'ID3v2')
                return ID3v2Mock;
            if (parser.name === 'Frames')
                return FramesMock;
        });
        spyOn(bucket, "createWriteStream").and.callFake(function (parser) {
            return gcsMock;
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
        ID3v1MockBoilerplate(ID3v1Mock);
        request.on_callbacks['end']();
    });

    it("Sends 500 on successful validation, but failure on makePublic", function (done) {
        requestBoilerplate(request);
        spyOn(bucket, 'makePublic').and.callFake(function () {
            // OK, fire a finish after a moment's time
            return new Promise((resolve, reject) => { reject("SOME KIND OF PUBLIC BUCKET FAILURE"); });
        });
        spyOn(gcsMock, 'end').and.callFake(function () {
            // OK, fire a finish after a moment's time
            setTimeout(() => { gcsMock.on_callbacks['finish'](); }, 100);
        });
        spyOn(firebasePendingRef, "once").and.callFake(function (cb) {
            return new Promise((resolve, reject) => { resolve(new snapshotMock("key1", "title1", "artist1", new Date().getTime())); });
        });
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        spyOn(request, "pipe").and.callFake(function (parser) {
            if (parser.name === 'ID3v1')
                return ID3v1Mock;
            if (parser.name === 'ID3v2')
                return ID3v2Mock;
            if (parser.name === 'Frames')
                return FramesMock;
        });
        spyOn(bucket, "createWriteStream").and.callFake(function (parser) {
            return gcsMock;
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
        ID3v1MockBoilerplate(ID3v1Mock);
        request.on_callbacks['end']();
    });

    it("Sends 500 failure on late upload", function (done) {
        requestBoilerplate(request);
        spyOn(gcsMock, 'destroy').and.callFake(function () {
            // OK, fire a close after a moment's time
            setTimeout(() => { gcsMock.on_callbacks['close'](); }, 100);
        });
        spyOn(firebasePendingRef, "once").and.callFake(function (cb) {
            return new Promise((resolve, reject) => { resolve(new snapshotMock("key1", "title1", "artist1", 100)); });
        });
        spyOn(response, "end").and.callFake(function () {
            expect(gcsMock.destroy).toHaveBeenCalled();
            expect(response.status === 500).toBe(true);
            done();
        });
        spyOn(request, "pipe").and.callFake(function (parser) {
            if (parser.name === 'ID3v1')
                return ID3v1Mock;
            if (parser.name === 'ID3v2')
                return ID3v2Mock;
            if (parser.name === 'Frames')
                return FramesMock;
        });
        spyOn(bucket, "createWriteStream").and.callFake(function (parser) {
            return gcsMock;
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
        ID3v1MockBoilerplate(ID3v1Mock);
        request.on_callbacks['end']();
    });

    it("Sends 500 failure on firebase upload token failed lookup", function (done) {
        requestBoilerplate(request);
        spyOn(gcsMock, 'destroy').and.callFake(function () {
            // OK, fire a close after a moment's time
            setTimeout(() => { gcsMock.on_callbacks['close'](); }, 100);
        });
        spyOn(firebasePendingRef, "once").and.callFake(function (cb) {
            return new Promise((resolve, reject) => { reject("SOME KIND of FIREBASE FAILURE LOOKING UP THE UPLOAD TOKEN"); });
        });
        spyOn(response, "end").and.callFake(function () {
            expect(gcsMock.destroy).toHaveBeenCalled();
            expect(response.status === 500).toBe(true);
            done();
        });
        spyOn(request, "pipe").and.callFake(function (parser) {
            if (parser.name === 'ID3v1')
                return ID3v1Mock;
            if (parser.name === 'ID3v2')
                return ID3v2Mock;
            if (parser.name === 'Frames')
                return FramesMock;
        });
        spyOn(bucket, "createWriteStream").and.callFake(function (parser) {
            return gcsMock;
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
        ID3v1MockBoilerplate(ID3v1Mock);
        request.on_callbacks['end']();
    });

    it("Sends 500 failure on missing tag information", function (done) {
        requestBoilerplate(request);
        spyOn(gcsMock, 'destroy').and.callFake(function () {
            // OK, fire a close after a moment's time
            setTimeout(() => { gcsMock.on_callbacks['close'](); }, 100);
        });
        spyOn(response, "end").and.callFake(function () {
            expect(gcsMock.destroy).toHaveBeenCalled();
            expect(response.status === 500).toBe(true);
            done();
        });
        spyOn(request, "pipe").and.callFake(function (parser) {
            if (parser.name === 'ID3v1')
                return ID3v1Mock;
            if (parser.name === 'ID3v2')
                return ID3v2Mock;
            if (parser.name === 'Frames')
                return FramesMock;
        });
        spyOn(bucket, "createWriteStream").and.callFake(function (parser) {
            return gcsMock;
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
        ID3v1Mock.on_callbacks['end']();
        request.on_callbacks['end']();
    });

    it("squashes request and destroys gcs stream for ID3v1 error", function (done) {
        // TODO would be nice to confirm that it doesn't try to send a 500 after the squash
        requestBoilerplate(request);
        spyOn(request, 'pause').and.callThrough();
        spyOn(request, 'destroy').and.callThrough();
        spyOn(request.connection, 'destroy').and.callThrough();
        spyOn(gcsMock, 'destroy').and.callFake(function () {
            expect(request.pause).toHaveBeenCalled();
            expect(request.connection.destroy).toHaveBeenCalled();
            expect(request.destroy).toHaveBeenCalled();
            expect(gcsMock.destroy).toHaveBeenCalled();
            done();
        });
        spyOn(request, "pipe").and.callFake(function (parser) {
            if (parser.name === 'ID3v1')
                return ID3v1Mock;
            if (parser.name === 'ID3v2')
                return ID3v2Mock;
            if (parser.name === 'Frames')
                return FramesMock;
        });
        spyOn(bucket, "createWriteStream").and.callFake(function (parser) {
            return gcsMock;
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
        ID3v1Mock.on_callbacks['error']("WHATEVER");
        // The simulated call above should result in a squash; after that we need to
        // simulate the stream close, which should result in a gcs stream close
        request.on_callbacks['close']();
    });

    it("squashes request and destroys gcs stream for ID3v2 tag present", function (done) {
        requestBoilerplate(request);
        spyOn(request, 'pause').and.callThrough();
        spyOn(request, 'destroy').and.callThrough();
        spyOn(request.connection, 'destroy').and.callThrough();
        spyOn(gcsMock, 'destroy').and.callFake(function () {
            expect(request.pause).toHaveBeenCalled();
            expect(request.connection.destroy).toHaveBeenCalled();
            expect(request.destroy).toHaveBeenCalled();
            expect(gcsMock.destroy).toHaveBeenCalled();
            done();
        });
        spyOn(request, "pipe").and.callFake(function (parser) {
            if (parser.name === 'ID3v1')
                return ID3v1Mock;
            if (parser.name === 'ID3v2')
                return ID3v2Mock;
            if (parser.name === 'Frames')
                return FramesMock;
        });
        spyOn(bucket, "createWriteStream").and.callFake(function (parser) {
            return gcsMock;
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
        ID3v2Mock.on_callbacks['data']("WHATEVER");
        // The simulated call above should result in a squash; after that we need to
        // simulate the stream close, which should result in a gcs stream close
        request.on_callbacks['close']();
    });

    it("sends 500 for incorrect content type", function (done) {
        request.method = 'POST';
        request.headers = {};
        request.headers['content-type'] = 'INCORRECT';
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
    });

    it("sends 500 for missing content type", function (done) {
        request.method = 'POST';
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
    });

    it("sends 500 for missing request method", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, firebasePendingRef, ID3v1, ID3v2, Frames, undefined, undefined);
        theApp.handleCreate(request, response);
    });
});

describe("handleVerify", function () {
    var theApp;
    var serverRequestCallback;
    function serverRequest(url, cb) { serverRequestCallback = cb; };
    var request;
    var response;
    var firebasePendingRef;
    var originalTimeout;

    beforeEach(function () {
        serverRequestCallback = undefined;
        theApp = new e12s(true);
        request = new requestMock;
        response = new responseMock;
        firebasePendingRef = new firebaseRefMock;
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;
    });

    afterEach(function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    });

    it("sends 500 for verify exception", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        spyOn(firebasePendingRef, "set").and.callFake(function (value, cb) { throw "EXCEPTION THROWN FROM VERIFY FIREBASE"; });
        theApp.setStateForTest(request, response, undefined, undefined, firebasePendingRef, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleVerify(request, response);
        request.on_callbacks['data']("{ \"g-recaptcha-response\": \"SOME_CAPTCHA_RESPONSE_FOR_UPLOAD\" }");
        request.on_callbacks['end']();
    });

    it("sends 500 for captcha failure", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        spyOn(firebasePendingRef, "set").and.callFake(function (value, cb) { cb(); });
        theApp.setStateForTest(request, response, undefined, undefined, firebasePendingRef, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleVerify(request, response);
        request.on_callbacks['data']("{ \"g-recaptcha-response\": \"SOME_CAPTCHA_RESPONSE_FOR_UPLOAD\" }");
        request.on_callbacks['end']();
        setTimeout(() => { serverRequestCallback(undefined, undefined, "{ \"success\": false }"); }, 100);
    });
    it("sends 200 for verify success", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 200).toBe(true);
            done();
        });
        spyOn(firebasePendingRef, "set").and.callFake(function (value, cb) { cb(); });
        theApp.setStateForTest(request, response, undefined, undefined, firebasePendingRef, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleVerify(request, response);
        request.on_callbacks['data']("{ \"g-recaptcha-response\": \"SOME_CAPTCHA_RESPONSE_FOR_UPLOAD\" }");
        request.on_callbacks['end']();
        setTimeout(() => { serverRequestCallback(undefined, undefined, "{ \"success\": true }"); }, 100);
    });

    it("sends 500 for firebase failure", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        spyOn(firebasePendingRef, "set").and.callFake(function (value, cb) { cb("FIREBASE FAILURE ON VERIFY!"); });
        theApp.setStateForTest(request, response, undefined, undefined, firebasePendingRef, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleVerify(request, response);
        request.on_callbacks['data']("{ \"g-recaptcha-response\": \"SOME_CAPTCHA_RESPONSE_FOR_UPLOAD\" }");
        request.on_callbacks['end']();
    });

    it("sends 500 for missing captcha", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleVerify(request, response);
        request.on_callbacks['end']();
    });

    it("destroys the request on data overflow", function (done) {
        spyOn(request, 'pause').and.callThrough();
        spyOn(request, 'destroy').and.callThrough();
        spyOn(request.connection, 'destroy').and.callThrough();
        theApp.setStateForTest(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleVerify(request, response);
        for (var i = 0; i < theApp.maxQueryDataLen + 1; i++) {
            request.on_callbacks['data']("F");
        }
        expect(request.pause).toHaveBeenCalled();
        expect(request.connection.destroy).toHaveBeenCalled();
        expect(request.destroy).toHaveBeenCalled();
        done();
    });

    it("destroys the request on data timeout", function (done) {
        spyOn(request, 'pause').and.callThrough();
        spyOn(request, 'destroy').and.callThrough();
        spyOn(request.connection, 'destroy').and.callFake(function () {
            expect(request.pause).toHaveBeenCalled();
            expect(request.connection.destroy).toHaveBeenCalled();
            expect(request.destroy).toHaveBeenCalled();
            done();
        });
        theApp.setStateForTest(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleVerify(request, response);
        setTimeout(() => { console.log("CALLING DATA TIMEOUT"); request.on_callbacks['data']("TIMEOUT"); }, theApp.maxQueryDataTime + 1000);
    });
});

describe("handleDelete", function () {
    var theApp;
    var serverRequestCallback;
    function serverRequest(url, cb) { serverRequestCallback = cb; };
    var request;
    var response;
    var firebaseSongsRef;
    var bucket;
    var originalTimeout;

    beforeEach(function () {
        serverRequestCallback = undefined;
        theApp = new e12s(true);
        request = new requestMock;
        response = new responseMock;
        firebaseSongsRef = new firebaseRefMock;
        bucket = new bucketMock;
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;
    });

    afterEach(function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    });

    it("destroys the request on data overflow", function (done) {
        spyOn(request, 'pause').and.callThrough();
        spyOn(request, 'destroy').and.callThrough();
        spyOn(request.connection, 'destroy').and.callThrough();
        theApp.setStateForTest(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleDelete(request, response);
        for (var i = 0; i < theApp.maxQueryDataLen + 1; i++) {
            request.on_callbacks['data']("F");
        }
        expect(request.pause).toHaveBeenCalled();
        expect(request.connection.destroy).toHaveBeenCalled();
        expect(request.destroy).toHaveBeenCalled();
        done();
    });

    it("destroys the request on data timeout", function (done) {
        spyOn(request, 'pause').and.callThrough();
        spyOn(request, 'destroy').and.callThrough();
        spyOn(request.connection, 'destroy').and.callFake(function () {
            expect(request.pause).toHaveBeenCalled();
            expect(request.connection.destroy).toHaveBeenCalled();
            expect(request.destroy).toHaveBeenCalled();
            done();
        });
        theApp.setStateForTest(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleDelete(request, response);
        setTimeout(() => { console.log("CALLING DATA TIMEOUT"); request.on_callbacks['data']("TIMEOUT"); }, theApp.maxQueryDataTime + 1000);
    });

    it("sends 500 for delete failure on firebase lookup", function (done) {
        spyOn(firebaseSongsRef, "once").and.callFake(function (cb) {
            return new Promise((resolve, reject) => { reject("SOME KIND of FIREBASE LOOKUP PROBLEM"); });
        });
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, firebaseSongsRef, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleDelete(request, response);
        request.on_callbacks['data']("{ \"deleteKey\": \"11111\", \"g-recaptcha-response\": \"SOME_CAPTCHA_RESPONSE\" }");
        request.on_callbacks['end']();
        setTimeout(() => { serverRequestCallback(undefined, undefined, "{ \"success\": true }"); }, 100);
    });

    it("sends 500 for delete failure on firebase remove", function (done) {
        spyOn(firebaseSongsRef, "remove").and.callFake(function (cb) {
            setTimeout(() => { cb("firebase delete key failed!"); }, 100);
        });
        spyOn(bucket, "delete").and.callFake(() => {
            return new Promise((resolve, reject) => { resolve(); });
        });
        spyOn(firebaseSongsRef, "once").and.callFake(() => {
            return new Promise((resolve, reject) => { resolve(new snapshotMock("key1", "title1", "artist1", "timestamp1")); });
        });
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleDelete(request, response);
        request.on_callbacks['data']("{ \"deleteKey\": \"22222\", \"g-recaptcha-response\": \"SOME_CAPTCHA_RESPONSE\" }");
        request.on_callbacks['end']();
        setTimeout(() => { serverRequestCallback(undefined, undefined, "{ \"success\": true }"); }, 100);
    });

    it("sends 200 for delete success", function (done) {
        spyOn(firebaseSongsRef, "remove").and.callFake(function (cb) {
            setTimeout(() => { cb(); }, 100);
        });
        spyOn(bucket, "delete").and.callFake(() => {
            return new Promise((resolve, reject) => { resolve(); });
        });
        spyOn(firebaseSongsRef, "once").and.callFake(() => {
            return new Promise((resolve, reject) => { resolve(new snapshotMock("key1", "title1", "artist1", "timestamp1")); });
        });
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 200).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleDelete(request, response);
        request.on_callbacks['data']("{ \"deleteKey\": \"33333\", \"g-recaptcha-response\": \"SOME_CAPTCHA_RESPONSE\" }");
        request.on_callbacks['end']();
        setTimeout(() => { serverRequestCallback(undefined, undefined, "{ \"success\": true }"); }, 100);
    });

    it("sends 200 for delete success even with a cloud storage error", function (done) {
        spyOn(firebaseSongsRef, "remove").and.callFake(function (cb) {
            setTimeout(() => { cb(); }, 100);
        });
        spyOn(bucket, "delete").and.callFake(() => {
            return new Promise((resolve, reject) => { reject("Some manner of CLOUD STORAGE ERROR"); });
        });
        spyOn(firebaseSongsRef, "once").and.callFake(() => {
            return new Promise((resolve, reject) => { resolve(new snapshotMock("key1", "title1", "artist1", "timestamp1")); });
        });
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 200).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, bucket, firebaseSongsRef, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleDelete(request, response);
        request.on_callbacks['data']("{ \"deleteKey\": \"44444\", \"g-recaptcha-response\": \"SOME_CAPTCHA_RESPONSE\" }");
        request.on_callbacks['end']();
        setTimeout(() => { serverRequestCallback(undefined, undefined, "{ \"success\": true }"); }, 100);
    });

    it("sends 500 for captcha success but no firebase ref", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleDelete(request, response);
        request.on_callbacks['data']("{ \"key\": \"55555\", \"g-recaptcha-response\": \"SOME_CAPTCHA_RESPONSE\" }");
        request.on_callbacks['end']();
        setTimeout(() => { serverRequestCallback(undefined, undefined, "{ \"success\": true }"); }, 100);
    });

    it("sends 500 for captcha failure", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleDelete(request, response);
        request.on_callbacks['data']("{ \"key\": \"77777\", \"g-recaptcha-response\": \"SOME_CAPTCHA_RESPONSE\" }");
        request.on_callbacks['end']();
        setTimeout(() => { serverRequestCallback(undefined, undefined, "{ \"success\": false }"); }, 100);
    });

    it("sends 500 for missing captcha", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleDelete(request, response);
        request.on_callbacks['data']("{ \"key\": \"88888\" }");
        request.on_callbacks['end']();
    });

    it("sends 500 for no parameters", function (done) {
        spyOn(response, "end").and.callFake(function () {
            expect(response.status === 500).toBe(true);
            done();
        });
        theApp.setStateForTest(request, response, undefined, undefined, undefined, undefined, undefined, undefined, serverRequest, undefined);
        theApp.handleDelete(request, response);
        request.on_callbacks['end']();
    });
});

describe("handleRead", function () {
    var theApp;
    var request;
    var response;
    var firebaseSongsRef;
    var originalTimeout;

    beforeEach(function () {
        theApp = new e12s(true);
        request = new requestMock;
        response = new responseMock;
        firebaseSongsRef = new firebaseRefMock;
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;
    });

    afterEach(function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    });

    it("follows the happy path for handleRead with key that is not found", function (done) {
        theApp.setStateForTest(undefined, undefined, undefined, firebaseSongsRef, undefined, undefined, undefined, undefined, undefined, undefined);
        theApp.handleRead(request, response);
        request.on_callbacks['data']("{ \"key\": \"99999\" }");
        request.on_callbacks['end']();
        firebaseSongsRef.once_callbacks['value']
            ([
                new snapshotMock("key1", "title1", "artist1", "timestamp1"),
                new snapshotMock("key2", "title2", "artist2", "timestamp2"),
                new snapshotMock("key3", "title3", "artist3", "timestamp3"),
                new snapshotMock("key4", "title4", "artist4", "timestamp4"),
            ]);
        expect(response.status === 200).toBe(true);
        expect(response.encoding === 'utf-8').toBe(true);
        expect(response.writeHeadObject['Content-Type'] === 'application/json').toBe(true);
        console.log("response.content IS " + response.content)
        expect(response.content === '{"urlRoot":"https://storage.googleapis.com/undefined.appspot.com","songInfo":[{"key":"key4","title":"title4","artist":"artist4","timestamp":"timestamp4"},{"key":"key3","title":"title3","artist":"artist3","timestamp":"timestamp3"},{"key":"key2","title":"title2","artist":"artist2","timestamp":"timestamp2"},{"key":"key1","title":"title1","artist":"artist1","timestamp":"timestamp1"}],"requestedSongKey":"99999"}').toBe(true);
        done();
    });

    it("follows the happy path for handleRead with key that is found", function (done) {
        theApp.setStateForTest(undefined, undefined, undefined, firebaseSongsRef, undefined, undefined, undefined, undefined, undefined, undefined);
        theApp.handleRead(request, response);
        request.on_callbacks['data']("{ \"key\": \"key4\" }");
        request.on_callbacks['end']();
        firebaseSongsRef.once_callbacks['value']
            ([
                new snapshotMock("key1", "title1", "artist1", "timestamp1"),
                new snapshotMock("key2", "title2", "artist2", "timestamp2"),
                new snapshotMock("key3", "title3", "artist3", "timestamp3"),
                new snapshotMock("key4", "title4", "artist4", "timestamp4"),
            ]);
        expect(response.status === 200).toBe(true);
        expect(response.encoding === 'utf-8').toBe(true);
        expect(response.writeHeadObject['Content-Type'] === 'application/json').toBe(true);
        console.log("response.content IS " + response.content)
        expect(response.content === '{"urlRoot":"https://storage.googleapis.com/undefined.appspot.com","songInfo":[{"key":"key3","title":"title3","artist":"artist3","timestamp":"timestamp3"},{"key":"key2","title":"title2","artist":"artist2","timestamp":"timestamp2"},{"key":"key1","title":"title1","artist":"artist1","timestamp":"timestamp1"}],"requestedSongKey":"key4"}').toBe(true);
        done();
    });

    it("follows the sad path for handleRead with key", function (done) {
        theApp.setStateForTest(undefined, undefined, undefined, firebaseSongsRef, undefined, undefined, undefined, undefined, undefined, undefined);
        theApp.handleRead(request, response);
        request.on_callbacks['data']("{ \"key\": \"99999\" }");
        request.on_callbacks['end']();
        firebaseSongsRef.once_fail_callbacks['value']("Firebase read failed!");
        expect(response.status === 500).toBe(true);
        done();
    });

    it("follows the happy path for handleRead with getUpdateCount", function (done) {
        var songInfoCache = [
            new snapshotMock("key4", "title4", "artist4", "timestamp4"),
            new snapshotMock("key3", "title3", "artist3", "timestamp3"),
            new snapshotMock("key2", "title2", "artist2", "timestamp2"),
            new snapshotMock("key1", "title1", "artist1", "timestamp1"),
        ];
        theApp.setStateForTest(undefined, songInfoCache, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
        theApp.handleRead(request, response);
        request.on_callbacks['data']("{ \"getUpdateCount\": \"true\", \"key\": \"key3\" }");
        request.on_callbacks['end']();
        expect(response.status === 200).toBe(true);
        expect(response.encoding === 'utf-8').toBe(true);
        expect(response.content === '{"updateCount":1,"plus":false}').toBe(true);
        done();
    });

    it("returns a snapshot for handleRead with no parameters", function (done) {
        var songInfoCache = [
            new snapshotMock("key9", "title4", "artist4", "timestamp4"),
            new snapshotMock("key8", "title3", "artist3", "timestamp3"),
            new snapshotMock("key7", "title2", "artist2", "timestamp2"),
            new snapshotMock("key6", "title1", "artist1", "timestamp1"),
        ];
        theApp.setStateForTest(undefined, songInfoCache, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
        theApp.handleRead(request, response);
        request.on_callbacks['end']();
        expect(response.status === 200).toBe(true);
        expect(response.encoding === 'utf-8').toBe(true);
        expect(response.content === '{"urlRoot":"https://storage.googleapis.com/undefined.appspot.com","songInfo":[{"key":"key9","title":"title4","artist":"artist4","timestamp":"timestamp4"},{"key":"key8","title":"title3","artist":"artist3","timestamp":"timestamp3"},{"key":"key7","title":"title2","artist":"artist2","timestamp":"timestamp2"},{"key":"key6","title":"title1","artist":"artist1","timestamp":"timestamp1"}]}').toBe(true);
        done();
    });

    it("destroys the request on data overflow", function (done) {
        spyOn(request, 'pause').and.callThrough();
        spyOn(request, 'destroy').and.callThrough();
        spyOn(request.connection, 'destroy').and.callThrough();
        theApp.setStateForTest(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
        theApp.handleRead(request, response);
        for (var i = 0; i < theApp.maxQueryDataLen + 1; i++) {
            request.on_callbacks['data']("F");
        }
        expect(request.pause).toHaveBeenCalled();
        expect(request.connection.destroy).toHaveBeenCalled();
        expect(request.destroy).toHaveBeenCalled();
        done();
    });

    it("destroys the request on data timeout", function (done) {
        spyOn(request, 'pause').and.callThrough();
        spyOn(request, 'destroy').and.callThrough();
        spyOn(request.connection, 'destroy').and.callFake(function () {
            expect(request.pause).toHaveBeenCalled();
            expect(request.connection.destroy).toHaveBeenCalled();
            expect(request.destroy).toHaveBeenCalled();
            done();
        });
        theApp.setStateForTest(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
        theApp.handleRead(request, response);
        setTimeout(() => { console.log("CALLING DATA TIMEOUT"); request.on_callbacks['data']("TIMEOUT"); }, theApp.maxQueryDataTime + 1000);
    });
});
