
var fs = require('fs');
var http = require('http');
var Gpio = require('pigpio').Gpio;
var Servo = new Gpio(4, {mode: Gpio.OUTPUT});

var RaspiCam = require("raspicam");

var start = 800;
var inc = 400;
var pos = 0;

var TimeStamp;// = parseInt((new Date()).getTime() / 1000);
var dataPacket = false;// = {};

var step = function(){
	//	Read humidity file and start a new data packet
	if (pos == 0){
		TimeStamp = parseInt((new Date()).getTime() / 1000);
		dataPacket = JSON.parse(fs.readFileSync(__dirname+'/data.json')) || {};
		dataPacket.timestamp = TimeStamp;
		dataPacket.images = {};
	}
	//
	Servo.servoWrite(start + inc*pos);
	//console.log(start+' + ('+inc+' * '+pos+')');
	//
	//	Give time for servo to move
	setTimeout(function(){
		var FileName = TimeStamp+'-'+pos+'.png';
		// Take picture and add to buffer
		new take_photo(FileName,
			function(image){
				//console.log(image);
				dataPacket.images[pos] = image;
				// Move to next position
				if (pos == 4){
					pos = 0;
					if (dataPacket != false){
						//console.log(JSON.stringify(dataPacket));
						upload_data(JSON.stringify(dataPacket));
					}
					//
					setTimeout(function(){step();}, 60000);
				}
				else{
					pos += 1;
					setTimeout(function(){step();}, 500);
				}
			});
	}, 500);
}
step();

//	Takes a photo from webcam and returns BASE64
var take_photo = function(filename, callback){
	var Camera = new RaspiCam({mode: 'photo', output: filename, encoding: 'png', timeout: 200, 'nopreview': true});
	var calledback = false;
	Camera.start();
	Camera.on("read", function(err, timestamp, filename){
		//console.log(filename);
		//
		if (calledback)
			return false;
		calledback = true;
		//
		setTimeout(function(){
			try{
				var bitmap = fs.readFileSync(__dirname+'/'+filename.substr(0, filename.length-1));
				bitmap = new Buffer(bitmap).toString('base64');
				fs.unlink(__dirname+'/'+filename.substr(0, filename.length-1));
			}catch(e){
				bitmap = false;
				fs.unlink(__dirname+'/'+filename);
			}
			callback(bitmap);
			Camera.stop();}, 1600);
	});
}

var upload_data = function(data){
	var apiCall = http.request(
		{port: 80, method: 'POST', host: 'api.sky.info.lk', path: '/api/put', headers: {'Content-Type': 'application/json'}},
		//{port: 8088, method: 'POST', host: '192.168.43.226', path: '/api/put', headers: {'Content-Type': 'application/json'}},
		function(response){
			//console.log(response);
			response.setEncoding('utf8');
			handle_post(response, function(api_response){
				console.log(api_response);
			});
		})
	.on('error', function(err){
		console.log(err);
	});
	//	Write data to request stream
	apiCall.write(data);
	apiCall.end();
}

//	Handler for multipart POST request/response body
function handle_post(req, callback){
	var body = '';
	req.on('data', function (data){
		body += data;
		if (body.length > 1e8)
			req.connection.destroy();
	});
	req.on('end', function (data){
		var post = body;
		try{
			post = JSON.parse(post);
		}
		catch(e){
			try{
				post = qs.parse(post);
			}
			catch(e){}
		}
		callback(post);
	});
}



