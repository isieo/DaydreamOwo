const express = require('express')
const Quaternion = require('quaternion');
const http = require('http');
const ws = require('ws');
const dgram = require('node:dgram');
const app = express();




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
const owoConn = dgram.createSocket('udp4');
function connectToOwo(){
  owoConn.connect(6969, 'localhost', (err) => {
    sendHandshake()
    owoConn.on('message', (msg, rinfo)=>{
      let msgType = msg.readUInt32BE(0)
      if (msgType > 100) {
        msgType = msg.readUInt32BE(0)
      }
      console.log(msgType,msg, rinfo)
      switch (msgType){
        case 1:
          sendHeartBeat();
          break
        case 10:
          sendPong(msg);
          break
      }
    })
  });
}

function getPacketSequence(){
  packetSeq = packetSeq + 1n
  return packetSeq++;
}

function sendHandshake(){
  const buffer = Buffer.allocUnsafe(12);
  buffer.writeUInt32BE(3,0)
  buffer.writeBigInt64BE(getPacketSequence(),4)
  // buffer.writeUInt32BE(0,12)
  // buffer.writeUInt32BE(0,16)
  // buffer.writeUInt32BE(0,20)
  //
  // buffer.writeUInt32BE(0,24)
  // buffer.writeUInt32BE(0,28)
  // buffer.writeUInt32BE(0,32)
  //
  // buffer.writeUInt32BE(8,36)
  // buffer.write("\9owoTrack8\0\69\0\0\0\0",37)
  // buffer.write('\0xff',53)
  owoConn.send(buffer, (err) => {
    console.log("Handshake")
  });
}

function sendHeartBeat(){
  const buffer = Buffer.allocUnsafe(16);
  buffer.writeUInt32BE(0,0)
  buffer.writeBigInt64BE(getPacketSequence(),4)
  owoConn.send(buffer, (err) => {
    console.log("Heartbeat")
  });
}

function sendPong(ping){
  const buffer = Buffer.allocUnsafe(16);
  buffer.writeUInt32BE(10,0)
  buffer.writeBigInt64BE(getPacketSequence(),4)
  buffer.writeInt32BE(ping.readInt32BE(12), 12);
  owoConn.send(buffer, (err) => {
    console.log("Heartbeat")
  });
}

// next 4 bytes - gyro rate x
// next 4 bytes - gyro rate y
// next 4 bytes - gyro rate z
function sendAccelerometer(daydreamData){
  const buffer = Buffer.allocUnsafe(24);
  buffer.writeUInt32BE(4,0)
  buffer.writeBigInt64BE(getPacketSequence(),4)
  buffer.writeFloatBE(daydreamData.xAcc,12)
  buffer.writeFloatBE(daydreamData.yAcc,16)
  buffer.writeFloatBE(daydreamData.zAcc,20)
  owoConn.send(buffer, (err) => {
    //console.log("Acceleration Sent")
  });
}

// next 4 bytes - gyro rate x
// next 4 bytes - gyro rate y
// next 4 bytes - gyro rate z
function sendGyro(daydreamData){
  // try{
    const buffer = Buffer.allocUnsafe(24);
    buffer.writeUInt32BE(2,0)
    buffer.writeBigInt64BE(getPacketSequence(),4)
    buffer.writeFloatBE(daydreamData.xGyro,12)
    buffer.writeFloatBE(daydreamData.yGyro,16)
    buffer.writeFloatBE(daydreamData.zGyro,20)
    owoConn.send(buffer, (err) => {
      console.log("Gyro Sent", buffer)
    });
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
    const buffer = Buffer.allocUnsafe(28);
    buffer.writeUInt32BE(1,0)
    buffer.writeBigInt64BE(getPacketSequence(),4)
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
    owoConn.send(buffer, (err) => {
      //console.log("Rotation Sent")
    });
  // }catch(e){
  //   console.log("invalid json", daydreamData)
  // }
}

var last_heart_beat = 0
function createOwoPayload(daydreamData){
  let data = []
  last_heart_beat= Date.now()
  daydreamData.length()

}
connectToOwo()

// Set up a headless websocket server that prints any
// events that come in.
const wsServer = new ws.Server({ noServer: true });
wsServer.on('connection', socket => {
  socket.on('message', message => {
    // try{
      let data = JSON.parse(message.toString('utf8').trim())
      sendGyro(data)
      sendAccelerometer(data)
      sendRotation(data)
    // }catch(e){
    //   console.log("invalid json", message.length)
    // }
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
