const Quaternion = require('quaternion')
const ws = require('ws')
const dgram = require('node:dgram')
const CryptoJS = require("crypto-js");
const DaydreamControllerNode = require('./daydream_node.js')


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
let trackerId = parseInt(process.argv[4]);
if (isNaN(trackerId)) trackerId = 0
  

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
  return packetSeq++
}

function sendHandshake(){
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
	packetBuffer.writeUInt32BE(0, 4);

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
		sendSensorInfo();
		closeWhenTimeout()
	})
}



function sendSensorInfo(){
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

function sendxSensorInfo(){
  const buffer = Buffer.allocUnsafe(16)
    buffer.writeUInt32BE(15,0)
    buffer.writeUInt32BE(trackerId,4)
    buffer.writeUInt32BE(1,8)
    buffer.writeUInt32BE(0,12)
  owoConn.send(buffer, (err) => {
    console.log("Sent Sensor Info")
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
function sendRotation(daydreamData){
  // try{
    const buffer = Buffer.allocUnsafe(4 + 8 + 1 + 1 + 4 + 4 + 4 + 4 + 1);
    buffer.writeUInt32BE(17,0) //type
    buffer.writeBigInt64BE(getPacketSequence(),4) //seq
	
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
function sendxRotation(daydreamData){
  // try{
    const buffer = Buffer.allocUnsafe(29)
    buffer.writeUInt32BE(1,0)
    buffer.writeBigInt64BE(getPacketSequence(),4)
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

    buffer.writeFloatBE(q.x,12)
    buffer.writeFloatBE(q.y,16)
    buffer.writeFloatBE(q.z,20)
    buffer.writeFloatBE(q.w,24)
	
    buffer.writeUintBE(trackerId, 12, 1) // trackerid
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
  }
  owoIsAlive = true
  closeWhenTimeout()
})



daydream = new DaydreamControllerNode()
daydream.onStateChange(function(data){
  if (owoIsAlive){
	//sendGyro(data)
	//sendAccelerometer(data)
	sendRotation(data)
  }
})

if (dayDreamID === 'scan') {
  daydream.scan()
}else{
  connectToOwo()
  daydream.connect(dayDreamID)
}