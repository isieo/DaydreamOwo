import Quaternion from 'quaternion'

import { Buffer } from "buffer"
function handshakePacket(){	
	const firmware_name = "SlimeConnect";
	const packetBuffer = new ArrayBuffer(
	  4 + // packet_type
	  4 + // board_type
	  4 + // imu_type
	  4 + // mcu_type
	  4 * 3 + // imu_info
	  4 + // firmware_build
	  1 + // firmware_name_length
	  firmware_name.length + // firmware_name
	  6 + // mac
	  1
	);
	
	const dataView = new DataView(packetBuffer);
	
	// packet_type
	dataView.setUint32(0, 3, false);
	
	// board_type
	dataView.setUint32(4, 0, false);
	
	// imu_type
	dataView.setUint32(8, 0, false);
	
	// mcu_type
	dataView.setUint32(12, 0, false);
	
	// imu_info
	dataView.setUint32(16, 0, false);
	dataView.setUint32(20, 0, false);
	dataView.setUint32(24, 0, false);
	
	// firmware_build
	dataView.setUint32(28, 2, false);
	
	// firmware_name_length
	dataView.setUint8(32, firmware_name.length);
	
	// firmware_name
	for (let i = 0; i < firmware_name.length; i++) {
	  dataView.setUint8(33 + i, firmware_name.charCodeAt(i));
	}
	
	// mac
	const mac = ['6E', '75', '04', '88', 'C1', '1B']; // hard-coded MAC address
	
	for (let i = 0; i < mac.length; i++) {
	  const byte = parseInt(mac[i], 16);
	  dataView.setUint8(33 + firmware_name.length + i, byte);
	}
	
	dataView.setUint8(33 + firmware_name.length + 6, 0);
	
	return packetBuffer;
}

function sensorInfoPacket(packetSeq,trackerId){
	const buffer = new ArrayBuffer(4 + 8 + 1 + 1 + 1);
	const dataView = new DataView(buffer);
	console.log("sensor packet for ", trackerId)
	dataView.setUint32(0, 15, false); // writeUInt32BE(value, offset) equivalent
	dataView.setBigInt64(4, packetSeq, false); // writeBigInt64BE(value, offset) equivalent
	dataView.setUint8(12, trackerId); // writeUInt8(value, offset) equivalent
	dataView.setUint8(13, 1);
	dataView.setUint8(14, 0);
	
	return buffer;
}

function heartBeatPacket(packetSeq){
	const buffer = new ArrayBuffer(16);
	const dataView = new DataView(buffer);
	dataView.setUint32(0,0,false)
	dataView.setBigInt64(4, packetSeq, false)
	return buffer
}

function pongPacket(packetSeq,ping){
	const buffer = new ArrayBuffer(16);
	const dataView = new DataView(buffer);
	dataView.setUint32(0, 10, false)
	dataView.setBigInt64(4, packetSeq, false); // writeBigInt64BE(value, offset) equivalent
	dataView.setUint32(12, ping.getUint32(12))
	return buffer
}

function accelerometerPacket(packetSeq,trackerId,daydreamData){
	const buffer = new ArrayBuffer(25);
	const dataView = new DataView(buffer);
	
	dataView.setUint32(0, 4, false); // type
	dataView.setBigInt64(4, packetSeq, false); // seq
	dataView.setFloat32(12, daydreamData.xAcc, false); // xAcc
	dataView.setFloat32(16, daydreamData.yAcc, false); // yAcc
	dataView.setFloat32(20, daydreamData.zAcc, false); // zAcc
	dataView.setUint8(24,trackerId); // datatype
	
	return buffer;
	}
	  

function rotationPacket(packetSeq, trackerId, daydreamData) {
	const buffer = new ArrayBuffer(33);
	const dataView = new DataView(buffer);
	
	dataView.setUint32(0, 17, false); // type
	dataView.setBigInt64(4, packetSeq, false); // seq
	dataView.setUint8(12, trackerId); // trackerId
	dataView.setUint8(13, 1); // datatype
	
	let q = null
	if (daydreamData.raw !== undefined){
		q = new Quaternion({w: daydreamData.raw[0], x: daydreamData.raw[1], y: daydreamData.raw[2], z: daydreamData.raw[3]});

		// q = new Quaternion.fromAxisAngle([daydreamData.raw[1],daydreamData.raw[2],daydreamData.raw[3]],daydreamData.raw[0])
	}else{
		q = new Quaternion([daydreamData.xOri, -daydreamData.zOri, daydreamData.yOri]);
		let sqrMagnitude = q.normSq();
		
		if (sqrMagnitude > 0) {
		  let angle = Math.sqrt(sqrMagnitude);
		  q = q.scale(angle);
		  q = Quaternion.fromAxisAngle([q.x, q.y, q.z], angle);
		} else {
		  q = new Quaternion(0, [0, 0, 0]);
		}
	}


	
	dataView.setFloat32(14, q.x, false);
	dataView.setFloat32(18, q.y, false);
	dataView.setFloat32(22, q.z, false);
	dataView.setFloat32(26, q.w, false);
	
	dataView.setUint8(30, 255); // Additional value
	
	return buffer;
  }


  

export { handshakePacket, sensorInfoPacket,pongPacket, heartBeatPacket, rotationPacket, accelerometerPacket }