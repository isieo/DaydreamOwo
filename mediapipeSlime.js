const express = require('express')
const Quaternion = require('quaternion')
const ws = require('ws')
const dgram = require('node:dgram')
const CryptoJS = require("crypto-js");
const app = express();
const findAngle = require('angle-between-landmarks'); // CommonJS


function calculateLandmarkQuaternion(landmark, firstLandmark) {
  // Extract position values of the current landmark
  const { x, y, z } = landmark;

  // Extract position values of the first recorded landmark (calibrated state)
  const { x: firstX, y: firstY, z: firstZ } = firstLandmark;

  // Calculate the direction vectors
  const currentDirection = [x - firstX, y - firstY, z - firstZ];
  const referenceDirection = [0, 0, 1]; // Assuming the reference direction is along the z-axis

  // Normalize the direction vectors
  const normalizedCurrentDirection = normalizeVector(currentDirection);
  const normalizedReferenceDirection = normalizeVector(referenceDirection);

  // Calculate the rotation axis and angle
  const rotationAxis = crossProduct(normalizedCurrentDirection, normalizedReferenceDirection);
  const rotationAngle = Math.acos(dotProduct(normalizedCurrentDirection, normalizedReferenceDirection));

  // Check if the rotation angle is close to zero
  const epsilon = 1e-6; // Adjust the epsilon value based on your requirements
  if (Math.abs(rotationAngle) < epsilon) {
    // Return an identity quaternion
    return new Quaternion();
  }

  // Calculate the quaternion representing the rotation
  const quaternion = Quaternion.fromAxisAngle(rotationAxis, rotationAngle);

  return quaternion;
}

function applyQuaternion(quaternion, position) {
  const vector = [position.x, position.y, position.z];
  const rotatedVector = quaternion.rotateVector(vector);
  return { x: rotatedVector[0], y: rotatedVector[1], z: rotatedVector[2] };
}

function normalizeVector(vector) {
  const norm = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);
  return [vector[0] / norm, vector[1] / norm, vector[2] / norm];
}

function dotProduct(vector1, vector2) {
  return vector1[0] * vector2[0] + vector1[1] * vector2[1] + vector1[2] * vector2[2];
}

function crossProduct(vector1, vector2) {
  const x = vector1[1] * vector2[2] - vector1[2] * vector2[1];
  const y = vector1[2] * vector2[0] - vector1[0] * vector2[2];
  const z = vector1[0] * vector2[1] - vector1[1] * vector2[0];
  return [x, y, z];
}



function calculateEulerAngles(landmark) {
  const deltaX = landmark.x - 0;
  const deltaY = landmark.y - 0;
  const deltaZ = landmark.z - 0;

  const yaw = Math.atan2(deltaY, deltaX);
  const pitch = Math.atan2(deltaZ, Math.sqrt(deltaX ** 2 + deltaY ** 2));
  const roll = Math.atan2(0, 0);  // Assuming no roll since the reference frame is at { x: 0, y: 0, z: 0 }

  return { x: yaw, y: pitch, z: roll };
}




/*
first 4 bytes - message type
( 0 = heartbeat
  1 = rotation
  2 = gyro
  3 = handshake
  4 = accelerometer)
next 8 bytes - packet id (+1 every time)
rotation:
(floats)
next 4 bytes - rotation quat x
next 4 bytes - rotation quat y
next 4 bytes - rotation quat z
next 4 bytes - rotation quat w
gyro:
(floats)
next 4 bytes - gyro rate x
next 4 bytes - gyro rate y
next 4 bytes - gyro rate z
64 byte packets
*/
var packetSeq = 0n
var handShaken = false
var connectionCloser = 0
var owoIsAlive = false
const owoConn = dgram.createSocket('udp4')
const dayDreamID = process.argv[2]
const dayDreamMac = hashStringToMAC(dayDreamID)
let landmarkReferences = []
let trackerIds = [0,1,2,3,4,5]



function hashStringToMAC(str) {
    var hash = CryptoJS.SHA1(str);
    var hexString = hash.toString(CryptoJS.enc.Hex);
    var macAddress = hexString.substr(0, 12);
    macAddress = macAddress.match(/.{1,2}/g).join(":");
    macAddress = macAddress.toUpperCase()
    return macAddress;
}
  
function closeWhenTimeout(){
  clearTimeout(connectionCloser)
  connectionCloser = setTimeout(()=>{
    console.log("Connection Timed Out, Retrying with Handshake..")
    handShaken = false
    packetSeq = 0n
    owoIsAlive = false
    sendHandshake()
    }, 10000)
}

function connectToOwo(){
  closeWhenTimeout()
  let address = 'localhost'
  if (process.argv[3]) {
	  address = process.argv[3]
  }
  console.log(`Connectin using address ${address}`)
  owoConn.connect(6969, address)
}

function getPacketSequence(){
  packetSeq = packetSeq + 1n
  return packetSeq
}


function sendHandshake(){
  //const buffer = Buffer.allocUnsafe(12)  // 12
  //buffer.writeUInt32BE(3,0)
  //buffer.writeBigInt64BE(getPacketSequence(),4)
  
  const firmware_name = "MediaPipeSlime"
  const packetBuffer = Buffer.allocUnsafe(
	  4 + 8 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 1 +
	  Buffer.byteLength(firmware_name) + // firmware_name
	  6
	);

	// packet_type
	packetBuffer.writeUInt32BE(3, 0);


	packetBuffer.writeBigInt64BE(getPacketSequence(),4)
	
	// board_type
	packetBuffer.writeUInt32BE(4, 12);

	// imu_type
	packetBuffer.writeUInt32BE(0, 16);

	// mcu_type
	packetBuffer.writeUInt32BE(0, 20);

	// imu_info
//	packetBuffer.writeUInt32BE(0, 16);
	//packetBuffer.writeUInt32BE(0, 20);
//	packetBuffer.writeUInt32BE(0, 24);

	// firmware_build
	packetBuffer.writeUInt32BE(2, 36);

	// firmware_name_length
	packetBuffer.writeUInt8(firmware_name.length, 40);

	// firmware_name
	packetBuffer.write(firmware_name, 41);

	//packetBuffer.writeUInt8(0, firmware_name.length);
	// mac
	let mac = dayDreamMac.split(':');
	
	for (let i = 0; i < mac.length/2; i++) {
		packetBuffer.writeUInt8(parseInt(mac.slice(i*2, i*2+2), 16),33+firmware_name.length+i);
	}
	//packetBuffer.writeUInt8(0, 33 + 6);
	handShaken = true

	owoConn.send(packetBuffer, (err) => {
		console.log("Sending Handshake")
		setTimeout(()=>{
			trackerIds.forEach((tid)=>{
			  sendSensorInfo(tid);
			})
		},1000)
		closeWhenTimeout()
	})
}

function sendOwoHandshake(){
  //const buffer = Buffer.allocUnsafe(12)  // 12
  //buffer.writeUInt32BE(3,0)
  //buffer.writeBigInt64BE(getPacketSequence(),4)
  
  const firmware_name = "DayDreamOwo\0"
  const packetBuffer = Buffer.allocUnsafe(
	  4 + // packet_type
	  4 + // board_type
	  4 + // imu_type
	  4 + // mcu_type
	  4 * 3 + // imu_info
	  4 + // firmware_build
	  1 + // firmware_name_length
	  Buffer.byteLength(firmware_name) + // firmware_name
	  6 +// mac
	  1
	);

	// packet_type
	packetBuffer.writeUInt32BE(3, 0);

	// board_type
	packetBuffer.writeUInt32BE(4, 4);

	// imu_type
	packetBuffer.writeUInt32BE(0, 8);

	// mcu_type
	packetBuffer.writeUInt32BE(0, 12);

	// imu_info
	packetBuffer.writeUInt32BE(0, 16);
	packetBuffer.writeUInt32BE(0, 20);
	packetBuffer.writeUInt32BE(0, 24);

	// firmware_build
	packetBuffer.writeUInt32BE(2, 28);

	// firmware_name_length
	//packetBuffer.writeUInt8(firmware_name.length, 32);

	// firmware_name
	packetBuffer.write(firmware_name, 32);

	packetBuffer.writeUInt8(0, firmware_name.length);
	// mac
	let mac = dayDreamMac.split(':');
	
	for (let i = 0; i < mac.length/2; i++) {
		packetBuffer.writeUInt8(parseInt(mac.slice(i*2, i*2+2), 16),33+firmware_name.length+i);
	}
	packetBuffer.writeUInt8(0, 33 + 6);
	handShaken = true

	owoConn.send(packetBuffer, (err) => {
		console.log("Sending Handshake")
        trackerIds.forEach((tid)=>{
          sendSensorInfo(tid);
        })
		closeWhenTimeout()
	})
}

function sendSensorInfo(trackerId){
  const buffer = Buffer.allocUnsafe(4 + 8 + 1 + 1 + 1)
    buffer.writeUInt32BE(15,0)
	buffer.writeBigInt64BE(getPacketSequence(),4)
	
    buffer.writeUInt8(trackerId,12)
    buffer.writeUInt8(1,13)
    buffer.writeUInt8(0,14)
  owoConn.send(buffer, (err) => {
    console.log(`Sent Sensor Info ${trackerId}`)
	sendHeartBeat()
	
  owoIsAlive = true
  })
}

function sendHeartBeat(){
  const buffer = Buffer.allocUnsafe(16)
  buffer.writeUInt32BE(0,0)
  buffer.writeBigInt64BE(getPacketSequence(),4)
  owoConn.send(buffer, (err) => {})
}

function sendPong(ping){
  const buffer = Buffer.allocUnsafe(16)
    buffer.writeUInt32BE(10,0)
    buffer.writeBigInt64BE(getPacketSequence(),4)
    buffer.writeInt32BE(ping.readInt32BE(12), 12)
    owoConn.send(buffer, (err) => {})
}

// next 4 bytes - gyro rate x
// next 4 bytes - gyro rate y
// next 4 bytes - gyro rate z
function sendAccelerometer(daydreamData){
  const buffer = Buffer.allocUnsafe(24)
  buffer.writeUInt32BE(4,0)
  buffer.writeBigInt64BE(getPacketSequence(),4)
  buffer.writeFloatBE(daydreamData.xAcc,12)
  buffer.writeFloatBE(daydreamData.yAcc,16)
  buffer.writeFloatBE(daydreamData.zAcc,20)
  owoConn.send(buffer, (err) => {
    //console.log("Acceleration Sent")
  })
}

// next 4 bytes - gyro rate x
// next 4 bytes - gyro rate y
// next 4 bytes - gyro rate z
function sendEAccelerometer(trackerId, prevLandmark, landmark, pose_update_interval  = 0.1){
  const buffer = Buffer.allocUnsafe(4 + 8 + 4 + 4 + 4 + 1)
  buffer.writeUInt32BE(4,0)
  buffer.writeBigInt64BE(getPacketSequence(),4)
  
  let ax = (landmark.x - prevLandmark.x) / pose_update_interval
  let ay = (landmark.y - prevLandmark.y) / pose_update_interval
  let az = (landmark.z - prevLandmark.z) / pose_update_interval
  
  buffer.writeFloatBE(ax,12)
  buffer.writeFloatBE(ay,16)
  buffer.writeFloatBE(az,20)
  buffer.writeUInt8(trackerId, 24);
  owoConn.send(buffer, (err) => {
    console.log("Acceleration Sent")
  })
}



// next 4 bytes - gyro rate x
// next 4 bytes - gyro rate y
// next 4 bytes - gyro rate z
function sendGyro(daydreamData){
  // try{
    const buffer = Buffer.allocUnsafe(24)
    buffer.writeUInt32BE(2,0)
    buffer.writeBigInt64BE(getPacketSequence(),4)
    buffer.writeFloatBE(daydreamData.xGyro,12)
    buffer.writeFloatBE(daydreamData.yGyro,16)
    buffer.writeFloatBE(daydreamData.zGyro,20)
    owoConn.send(buffer, (err) => {
      //console.log("Gyro Sent", buffer)
    })
     // }catch(e){
 //      console.log("invalid json", daydreamData)
 //    }
}

// next 4 bytes - gyro rate x
// next 4 bytes - gyro rate y
// next 4 bytes - gyro rate z
// next 4 bytes - gyro rate w
function sendRotation(trackerId, landmarkData, landmarkOrigin){
  // try{
    const buffer = Buffer.allocUnsafe(4 + 8 + 1 + 1 + 4 + 4 + 4 + 4 + 1);
    buffer.writeUInt32BE(17,0) //type
    buffer.writeBigInt64BE(getPacketSequence(),4) //seq
	
    buffer.writeUintBE(trackerId, 12, 1) // trackerid
	buffer.writeUintBE(1, 13, 1); // datattype

    // using Quaternion node library, maths :/
    //let q = new Quaternion([landmarkData.x,landmarkData.y,landmarkData.z],'XYZ')
	//let landmarkEulers =  calculateEulerAngles(landmarkData)
    //let q = new Quaternion([landmarkEulers.x,landmarkEulers.z,landmarkEulers.y])
	//let q = calculateLandmarkQuaternion(landmarkData,{x:0,y:0,z:0})
   /* let sqrMagnitude = q.normSq()//(state.xOri ^2) + (state.yOri ^2) + (state.zOri ^2)
    if (sqrMagnitude > 0){
      let angle = Math.sqrt(sqrMagnitude)
      q = q.scale(angle)
      q = Quaternion.fromAxisAngle([q.x,q.y,q.z],angle)
      //q.w = sqrMagnitude
    } else {
	  q = new Quaternion(0,[0,0,0])
	}*/
	  let q = new Quaternion(0,[landmarkData.x,landmarkData.y,landmarkData.z])
	q.normalize()
	console.log(q)
	
    buffer.writeFloatBE(q.x,14)
    buffer.writeFloatBE(q.y,18)
    buffer.writeFloatBE(q.z,22)
    buffer.writeFloatBE(q.w,26)
    
    buffer.writeUintBE(255, 30, 1);

    owoConn.send(buffer, (err) => {
      //console.log(`Tracker ${trackerId}:Rotation Sent`)
    })
      // }catch(e){
  //   console.log("invalid json", daydreamData)
  // }
}

// next 4 bytes - gyro rate x
// next 4 bytes - gyro rate y
// next 4 bytes - gyro rate z
// next 4 bytes - gyro rate w
function sendOwoRotation(daydreamData){
    // try{
      const buffer = Buffer.allocUnsafe(28)
      buffer.writeUInt32BE(1,0)
      buffer.writeBigInt64BE(getPacketSequence(),4)
      // using Quaternion node library, maths :/
      let q = new Quaternion([daydreamData.xOri,-daydreamData.zOri,daydreamData.yOri]) // z and y is flipped for some reason
		 let sqrMagnitude = q.normSq()//(state.xOri ^2) + (state.yOri ^2) + (state.zOri ^2)
		 if (sqrMagnitude > 0){
		   let angle = Math.sqrt(sqrMagnitude)
		   q = q.scale(angle)
		   q = Quaternion.fromAxisAngle([q.x,q.y,q.z],angle)
		   q.w = sqrMagnitude
		 } else {
              q = new Quaternion(0,[0,0,0])
	    }
  
      buffer.writeFloatBE(q.x,12)
      buffer.writeFloatBE(q.y,16)
      buffer.writeFloatBE(q.z,20)
      buffer.writeFloatBE(q.w,24)
      owoConn.send(buffer, (err) => {
        //console.log("Rotation Sent")
      })
        // }catch(e){
    //   console.log("invalid json", daydreamData)
    // }
  }

owoConn.on('message', (msg, rinfo)=>{
  let msgType = msg.readUInt32BE(0)
  if (msgType > 100) {
    msgType = msg.readUInt32LE(0)
  }
  switch (msgType){
    case 1:
      sendHeartBeat()
            break
    case 10:
      sendPong(msg)
            break
	case 15:
	   // trackerIds.forEach((tid)=>{
      //    sendSensorInfo(tid);
       // })
		break
  }
  owoIsAlive = true
  closeWhenTimeout()
})


  connectToOwo()


// Set up a headless websocket server that prints any
// events that come in.

let firstLandmarks = null
let previousReceivedTime = 0
let previouslandmarks = null
let identity = {x:0,y:0,z:0}
const wsServer = new ws.Server({ noServer: true });
wsServer.on('connection', socket => {
  socket.on('message', message => {
    // try{
   if (owoIsAlive){
		  let landmarks = JSON.parse(message.toString('utf8').trim())
		//   sendGyro(data)
		//   sendAccelerometer(data)
		     if (firstLandmarks === null) {
				 firstLandmarks = landmarks
			 }
			 
			if (false && previouslandmarks !== null){
				let timediff = process.hrtime() - previousReceivedTime
				sendEAccelerometer(0, previouslandmarks[25], landmarks[25],timediff)
				sendEAccelerometer(1, previouslandmarks[26], landmarks[26],timediff)
				sendEAccelerometer(2, previouslandmarks[27], landmarks[27],timediff)
				sendEAccelerometer(3, previouslandmarks[28], landmarks[28],timediff)			
			}
			previouslandmarks = landmarks
			previousReceivedTime = process.hrtime()
			
			
			sendRotation(0, landmarks[25],identity)
			sendRotation(1, landmarks[26],identity)
			
			
			sendRotation(2, landmarks[27],identity)
			sendRotation(3, landmarks[28],identity)
			
			sendRotation(4, landmarks[31],identity)
			sendRotation(5, landmarks[32],identity)
			
		// }catch(e){
		//   console.log("invalid json", message.length)
		// }
	}
  });
});

// `server` is a vanilla Node.js HTTP server, so use
// the same ws upgrade process described here:
// https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server

//start our server
const server = app.listen(6767, () => {
    console.log(`Server started on port ${server.address().port} :)`);
});
server.on('upgrade', (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, socket => {
    wsServer.emit('connection', socket, request);
  });
});