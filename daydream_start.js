
const Quaternion = require('quaternion')
const dgram = require('node:dgram')
const DaydreamControllerNode = require('./daydream_node.js')


const { networkInterfaces } = require('os');


let slimeAddress = 'localhost'

const nets = networkInterfaces();
const results = Object.create(null); // Or just '{}', an empty object

for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
        const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
        if (net.family === familyV4Value && !net.internal) {
			slimeAddress = net.address;
			break
        }
		break
    }
		break
}

slimeAddress='127.0.0.1'  // Enter your Computer's Network Ip here

// Run scan.bat to get your tracker id
let trackerIds = [
	'ENTER YOUR TRACKER ID HERE', 
	'ENTER YOUR TRACKER ID HERE'   // Remove this line if you only have 1 daydream controller
]
let controllers = []
let slimePort = 6969


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
var slimeIsAlive = false
const slimeConn = dgram.createSocket('udp4', true)
  
function connOpener(){
    handShaken = false
    packetSeq = -1n
    slimeIsAlive = false
    sendHandshake()
}
  
function closeWhenTimeout(){
  clearTimeout(connectionCloser)
  connectionCloser = setTimeout(()=>{
    console.log("Connection Timed Out, Retrying with Handshake..")
	connOpener();
    }, 10000)
}

function connectToslime(){
  closeWhenTimeout()
  slimeConn.connect(slimePort, slimeAddress, ()=>{	  
		connOpener()
	  })
	slimeConn.on('listening', () => {
	  const address = slimeConn.address();
	  console.log(`server listening ${address.address}:${address.port}`);
	});
	slimeConn.on('message', (msg, rinfo)=>{
	  closeWhenTimeout()
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
	  }
	  slimeIsAlive = true
	  //console.log("Alive")
	})
}

function getPacketSequence(){
  //packetSeq = packetSeq + 1n
  return packetSeq++
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
	
	const mac = ['6E', '75', '04', '88', 'C1', '16']; // hard-coded MAC address
	
	for (let i = 0; i < mac.length/2; i++) {
		packetBuffer.writeUInt8(parseInt(mac.slice(i*2, i*2+2), 16),33+firmware_name.length+i);
	}
	//packetBuffer.writeUInt8(0, 33 + 6);
	handShaken = true

	slimeConn.send(packetBuffer, (err) => {
		console.log("Sending Handshake")
		setTimeout(()=>{
			trackerIds.forEach((tid,i)=>{
			  sendSensorInfo(i);
			})
		},1000)
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
	slimeConn.send(buffer, (err) => {
		console.log(`Sent Sensor Info ${trackerId}`)
		sendHeartBeat()
		slimeIsAlive = true
  })
}
  

function sendxSensorInfo(){
  const buffer = Buffer.allocUnsafe(16)
    buffer.writeUInt32BE(15,0)
    buffer.writeUInt32BE(trackerId,4)
    buffer.writeUInt32BE(1,8)
    buffer.writeUInt32BE(0,12)
  slimeConn.send(buffer, (err) => {
    console.log("Sent Sensor Info")
	sendHeartBeat()
	
  slimeIsAlive = true
  })
}

function sendHeartBeat(){
  const buffer = Buffer.allocUnsafe(16)
  buffer.writeUInt32BE(0,0)
  buffer.writeBigInt64BE(getPacketSequence(),4)
  slimeConn.send(buffer, (err) => {
	//  console.log("heartbeat")
  })
}

function sendPong(ping){
  const buffer = Buffer.allocUnsafe(16)
    buffer.writeUInt32BE(10,0)
  buffer.writeBigInt64BE(getPacketSequence(),4)
  buffer.writeInt32BE(ping.readInt32BE(12), 12)
    slimeConn.send(buffer, (err) => {})
}

function normalizeVector(vector) {
  const norm = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);
  return [vector[0] / norm, vector[1] / norm, vector[2] / norm];
}

// Previous accelerometer readings
const imuPreviousReadings = {};

function sendAccelerometer2(trackerId, daydreamData, packSq) {
  // Check if the IMU exists in the object, if not, initialize its previous readings
  if (!imuPreviousReadings.hasOwnProperty(trackerId)) {
    imuPreviousReadings[trackerId] = { xAcc: daydreamData.xAcc, yAcc: daydreamData.yAcc, zAcc: daydreamData.zAcc };
  }

  // Calculate the difference between current and previous accelerometer readings
  const xAccDiff = daydreamData.xAcc - imuPreviousReadings[trackerId].xAcc;
  const yAccDiff = daydreamData.yAcc - imuPreviousReadings[trackerId].yAcc;
  const zAccDiff = daydreamData.zAcc - imuPreviousReadings[trackerId].zAcc;

  // Update the previous accelerometer readings with the current readings
  imuPreviousReadings[trackerId] = { xAcc: daydreamData.xAcc, yAcc: daydreamData.yAcc, zAcc: daydreamData.zAcc };

  // Rest of the code to send the accelerometer difference data
  const buffer = Buffer.allocUnsafe(4 + 8 + 4 + 4 + 4 + 1);
  buffer.writeUInt32BE(4, 0);
  buffer.writeBigInt64BE(packSq, 4);
  buffer.writeFloatBE(xAccDiff, 12);
  buffer.writeFloatBE(yAccDiff, 16);
  buffer.writeFloatBE(zAccDiff, 20);
  buffer.writeUInt8(trackerId, 24);

  slimeConn.send(buffer, (err) => {
    // Handle error or other logic
  });
}

// next 4 bytes - gyro rate x
// next 4 bytes - gyro rate y
// next 4 bytes - gyro rate z
function sendAccelerometer(trackerId, daydreamData, packSq){
  const buffer = Buffer.allocUnsafe(4 + 8 + 4 + 4 + 4 + 1)
  
  buffer.writeUInt32BE(4,0)
  buffer.writeBigInt64BE(packSq,4)
  buffer.writeFloatBE(daydreamData.xAcc,12)
  buffer.writeFloatBE(daydreamData.yAcc,16)
  buffer.writeFloatBE(daydreamData.zAcc,20)
  buffer.writeUInt8(trackerId, 24);
  slimeConn.send(buffer, (err) => {
    //console.log("Acceleration Sent")
  })
}

// next 4 bytes - gyro rate x
// next 4 bytes - gyro rate y
// next 4 bytes - gyro rate z
// next 4 bytes - gyro rate w
function sendRotation(trackerId, daydreamData, packSq){
  // try{
    const buffer = Buffer.allocUnsafe(4 + 8 + 1 + 1 + 4 + 4 + 4 + 4 + 1);
    buffer.writeUInt32BE(17,0) //type
    buffer.writeBigInt64BE(packSq,4) //seq
	
    buffer.writeUintBE(trackerId, 12, 1) // trackerid
	buffer.writeUintBE(1, 13, 1); // datattype

    // using Quaternion node library, maths :/
    let q = new Quaternion([daydreamData.xOri,-daydreamData.zOri,daydreamData.yOri]) // z and y is flipped for some reason
    let sqrMagnitude = q.normSq()//(state.xOri ^2) + (state.yOri ^2) + (state.zOri ^2)
    if (sqrMagnitude > 0){
      let angle = Math.sqrt(sqrMagnitude)
      q = q.scale(angle)
      q = Quaternion.fromAxisAngle([q.x,q.y,q.z],angle)
      // q.w = sqrMagnitude
    } else {
			q = new Quaternion(0,[0,0,0])
	}
	
    buffer.writeFloatBE(q.x,14)
    buffer.writeFloatBE(q.y,18)
    buffer.writeFloatBE(q.z,22)
    buffer.writeFloatBE(q.w,26)
    
    buffer.writeUintBE(255, 30, 1);

    slimeConn.send(buffer, (err) => {
      //console.log(`Tracker ${trackerId}:Rotation Sent`)
    })
      // }catch(e){
  //   console.log("invalid json", daydreamData)
  // }
}

trackerIds.forEach((tid,i)=>{
	let daydream = new DaydreamControllerNode()
	daydream.onStateChange(function(data){
	
	  if (slimeIsAlive){
		sendRotation(i,data,getPacketSequence())
		sendAccelerometer(i,data,getPacketSequence())
	  }
	})

  daydream.connect(tid)
  controllers.push(daydream)
})

  connectToslime()
  