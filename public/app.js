mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

// DEfault configuration - Change these if you have a different STUN or TURN server.
const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let roomDialog = null;
let roomId = null;

function init() {
  document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
  document.querySelector('#hangupBtn').addEventListener('click', hangUp);
  document.querySelector('#createBtn').addEventListener('click', createRoom);
  document.querySelector('#joinBtn').addEventListener('click', joinRoom);
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
}

async function createRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;
  const db = firebase.firestore();
  const roomRef = await db.collection('rooms').doc();

  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners();

  const callercandidatesCollection = roomRef.collection('callerCandidates');

  peerConnection.addEventListener('icecandidate', event => {//IMPORTANT: This needs to be set before creating the offer!!!!
    if (event.candidate) {
      const json = event.candidate.toJSON();
      callercandidatesCollection.add(json);
  }
  console.log('Test 2');
  });

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });


  const offer = await peerConnection.createOffer(); //create an RTCSessionDescription that will represnt the offer from the caller
  await peerConnection.setLocalDescription(offer); //set this as a local description
  
  const roomWithOffer = {
      offer: {
          type: offer.type,
          sdp: offer.sdp
      }
  }
  await roomRef.set(roomWithOffer); //add new room object to database in Cloud Firestore
  const roomId = roomRef.id;
  document.querySelector('#currentRoom').innerText = `Current room is ${roomId} - You are the caller!`
  
  // Code for creating room above
  
  
  // Code for creating a room below
  
  // Code for creating a room above

  // Code for collecting ICE candidates below

  
  

 

  // Code for collecting ICE candidates above

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });

  // Listening for remote session description below
  roomRef.onSnapshot(async snapshot => { //Runs everytime there is a change to this object and includes a snapshot of the object at the moment of change
    console.log('Got updated room:', snapshot.data());
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data.answer) {
        console.log('Set remote description: ', data.answer);
        const answer = new RTCSessionDescription(data.answer)
        await peerConnection.setRemoteDescription(answer);
    }
});
  

  // Listening for remote session description above

  // Listen for remote ICE candidates below

  roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        peerConnection.addIceCandidate(candidate);
      }
    });
  })
  // Listen for remote ICE candidates above
}


function joinRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  document.querySelector('#confirmJoinBtn').
      addEventListener('click', async () => {
        roomId = document.querySelector('#room-id').value;
        console.log('Join room: ', roomId);
        document.querySelector(
            '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
        await joinRoomById(roomId);
      }, {once: true});
  roomDialog.open();
}

async function joinRoomById(roomId) {
  const db = firebase.firestore();
  const roomRef = db.collection('rooms').doc(`${roomId}`);
  const roomSnapshot = await roomRef.get();
  console.log('Got room:', roomSnapshot.exists);

  if (roomSnapshot.exists) {
    console.log('Create PeerConnection with configuration: ', configuration);
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Code for collecting ICE candidates below

    
    const calleecandidatesCollection = roomRef.collection('calleeCandidates'); //Gets current list of candidates

    peerConnection.addEventListener('icecandidate', event => { //get candidates from API
      if (event.candidate) {
        const json = event.candidate.toJSON();
        calleecandidatesCollection.add(json);
        
    }
    console.log('Test 1');
    });
    
    
    // Code for collecting ICE candidates above

    peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the remoteStream:', track);
        remoteStream.addTrack(track);
      });
    });
    

    // Code for creating SDP answer below
    const offer = roomSnapshot.data().offer; //gets offer from Cloud from snapshot taken from room ID provided
    await peerConnection.setRemoteDescription(offer); //Set the remote description to the offer, so an answer cna be generated by the create answer procedure
    const answer = await peerConnection.createAnswer(); 
    await peerConnection.setLocalDescription(answer); //set the local description to the answer

    const roomWithAnswer = {
        answer: {
            type: answer.type,
            sdp: answer.sdp
        }
    }
    await roomRef.update(roomWithAnswer); //this update will trigger the snapshot in the callee and update their sessionde

    // Code for creating SDP answer above

    // Listening for remote ICE candidates below

    roomRef.collection('callerCandidates').onSnapshot(snapshot => { //When remote peer has ICE candidate added
      snapshot.docChanges().forEach(change => {
        if (change.type === "added") { //Check it is a new addition
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate); //Add it to the peerconnection object
        }
      });
    })
  
  
    // Listening for remote ICE candidates above
  }
}

async function openUserMedia(e) {
  const stream = await navigator.mediaDevices.getUserMedia(
      {video: true, audio: true});
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;
  remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;

  console.log('Stream:', document.querySelector('#localVideo').srcObject);
  document.querySelector('#cameraBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#hangupBtn').disabled = false;
}

async function hangUp(e) {
  const tracks = document.querySelector('#localVideo').srcObject.getTracks();
  tracks.forEach(track => {
    track.stop();
  });

  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
  }

  document.querySelector('#localVideo').srcObject = null;
  document.querySelector('#remoteVideo').srcObject = null;
  document.querySelector('#cameraBtn').disabled = false;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = true;
  document.querySelector('#currentRoom').innerText = '';

  // Delete room on hangup
  if (roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(roomId);
    const calleeCandidates = await roomRef.collection('calleeCandidates').get();
    calleeCandidates.forEach(async candidate => {
      await candidate.delete();
    });
    const callerCandidates = await roomRef.collection('callerCandidates').get();
    callerCandidates.forEach(async candidate => {
      await candidate.delete();
    });
    await roomRef.delete();
  }

  document.location.reload(true);
}

function registerPeerConnectionListeners() {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
        `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });

  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
  });

  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
        `ICE connection state change: ${peerConnection.iceConnectionState}`);
  });
}

init();
