const noble = require('noble-winrt');
function DaydreamControllerNode() {

	var state = {};

	function connect(uid=null) {
		
		console.log(`Searching for Daydream with id: ${uid}`)
		noble.on('stateChange', state => {
		  if (state === 'poweredOn') {
			noble.startScanning([0xfe55], false);
		  } else {
			noble.stopScanning();
		  }
		});
		
		noble.on('discover', peripheral => {
		 console.log(peripheral.advertisement.localName)
		 console.log(peripheral.id, uid, peripheral.advertisement.localName === 'Daydream controller' && peripheral.id === uid)
		  if (peripheral.advertisement.localName === 'Daydream controller' && peripheral.id === uid) {
			noble.stopScanning();
			console.log(`Connected to ${uid}`)
			connectToDevice(peripheral)
		  }
		});
	}
	
	function connectToDevice (peripheral){
		peripheral.connect(error => {
		  if (error) {
			console.log(`Error connecting to daydream: ${error}`);
			return;
		  }

		  peripheral.discoverServices([0xfe55], (error, services) => {
			if (error) {
			  console.log(`Error discovering services: ${error}`);
			  return;
			}
			services.forEach(function(service){
				  service.discoverCharacteristics(['00000001-1000-1000-8000-00805f9b34fb'], (error, characteristics) => {
				  if (error) {
					console.log(`Error discovering characteristics: ${error}`);
					return;
				  }

				  for(const characteristic of characteristics){
					  characteristic.on('read', handleData);
					  characteristic.subscribe(function(err){
						  characteristic.read();
					  });
				 }
				});
			})
		  });
		});
		peripheral.on('disconnect', function() {
			console.log('Daydream controller disconnected. Attempting to reconnect...');
			setTimeout(() => {
				connect();
			}, 5000);
		});
	}

	function scan () {
		console.log('Scan started')
		console.log('Once you found your Daydream id, copy it and paste it in start.bat')
		noble.on('stateChange', state => {
		  if (state === 'poweredOn') {
			noble.startScanning([0xfe55], false);
		  } else {
			noble.stopScanning();
		  }
		});
		noble.on('discover', peripheral => {
		 if (peripheral.advertisement.localName === 'Daydream controller'){
			console.log("Found Daydream controller with id: ", peripheral.id)
		 }
		});
	}

    function handleData(data) {
        var data = new Uint8Array(data);

        state.isClickDown = (data[18] & 0x1) > 0;
        state.isAppDown = (data[18] & 0x4) > 0;
        state.isHomeDown = (data[18] & 0x2) > 0;
        state.isVolPlusDown = (data[18] & 0x10) > 0;
        state.isVolMinusDown = (data[18] & 0x8) > 0;

        state.time = ((data[0] & 0xFF) << 1 | (data[1] & 0x80) >> 7);

        state.seq = (data[1] & 0x7C) >> 2;

        state.xOri = (data[1] & 0x03) << 11 | (data[2] & 0xFF) << 3 | (data[3] & 0x80) >> 5;
        state.xOri = (state.xOri << 19) >> 19;
        state.xOri *= (2 * Math.PI / 4095.0);

        state.yOri = (data[3] & 0x1F) << 8 | (data[4] & 0xFF);
        state.yOri = (state.yOri << 19) >> 19;
        state.yOri *= (2 * Math.PI / 4095.0);

        state.zOri = (data[5] & 0xFF) << 5 | (data[6] & 0xF8) >> 3;
        state.zOri = (state.zOri << 19) >> 19;
        state.zOri *= (2 * Math.PI / 4095.0);

        state.xAcc = (data[6] & 0x07) << 10 | (data[7] & 0xFF) << 2 | (data[8] & 0xC0) >> 6;
		state.xAcc = (state.xAcc << 19) >> 19;
		state.xAcc *= (8 * 9.8 / 4095.0);
		state.yAcc = (data[8] & 0x3F) << 7 | (data[9] & 0xFE) >>> 1;
		state.yAcc = (state.yAcc << 19) >> 19;
		state.yAcc *= (8 * 9.8 / 4095.0);

		state.zAcc = (data[9] & 0x01) << 12 | (data[10] & 0xFF) << 4 | (data[11] & 0xF0) >> 4;
		state.zAcc = (state.zAcc << 19) >> 19;
		state.zAcc *= (8 * 9.8 / 4095.0);

		state.xGyr = (data[11] & 0x0F) << 9 | (data[12] & 0xFF) << 1 | (data[13] & 0x80) >> 7;
		state.xGyr = (state.xGyr << 19) >> 19;
		state.xGyr *= (2000 / 4095.0);

		state.yGyr = (data[13] & 0x7F) << 6 | (data[14] & 0xFC) >> 2;
		state.yGyr = (state.yGyr << 19) >> 19;
		state.yGyr *= (2000 / 4095.0);

		state.zGyr = (data[14] & 0x03) << 13 | (data[15] & 0xFF) << 5 | (data[16] & 0xF8) >> 3;
		state.zGyr = (state.zGyr << 19) >> 19;
		state.zGyr *= (2000 / 4095.0);

		state.xTouch = (data[16] & 0x07) << 10 | (data[17] & 0xFF) << 2 | (data[18] & 0xC0) >> 6;
		state.xTouch = (state.xTouch << 19) >> 19;
		state.xTouch /= 1023.0;

		state.yTouch = (data[18] & 0x3F) << 7 | (data[19] & 0xFE) >>> 1;
		state.yTouch = (state.yTouch << 19) >> 19;
		state.yTouch /= 1023.0;
		
		onStateChangeCallback( state );
	}

	function onStateChangeCallback() {}


	return {
		connect: connect,
		scan: scan,
		onStateChange: function ( callback ) {
			onStateChangeCallback = callback;
		}
	}

}

module.exports = DaydreamControllerNode