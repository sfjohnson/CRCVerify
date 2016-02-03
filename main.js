/*
Copyright (c) 2016, Sam Johnson https://github.com/sfjohnson

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/

var basePath = '/Volumes';
const outFileName = 'result.txt';

const fs = require('fs');
const crc64 = require('./crc64.js').crc64;

const ignoreFiles = ['.DS_Store', 'ehthumbs_vista.db', 'Thumbs.db'];

var fileChunk = new Buffer(134217728); //128 MiB

var outData = [];
var outFile = '';

var progressPos = 0;

function scanDir (path)
{
	var contents = fs.readdirSync(basePath + path);

	contents.sort();

	for (var i = 0; i < contents.length; i++)
	{
		var fullPath = path === '' ? contents[i] : path + '/' + contents[i];
		var stats = fs.lstatSync(basePath + fullPath);

		if (stats.isSymbolicLink())
		{
			//DEBUG: log
			console.log(fullPath, 'is symlink, ignoring');
			continue;
		}

		if (stats.isFile())
		{
			if (ignoreFiles.indexOf(contents[i]) === -1)
				outData.push({ file: fullPath, hash: '' });
		}
		else if (stats.isDirectory())
		{
			scanDir(fullPath);
		}
	}

}

if (basePath[basePath.length-1] !== '/')
	basePath += '/';

scanDir('');


console.log(outData.length + ' files\n');
console.log('|0----------------------------50--------------------------100|')
process.stdout.write('|');

for (var i = 0; i < outData.length; i++)
{
	var fd = fs.openSync(basePath + outData[i].file, 'r');

	var bytesRead;
	var pos = 0;
	var crcHigh = 0, crcLow = 0;

	do
	{
		bytesRead = fs.readSync(fd, fileChunk, 0, fileChunk.byteLength, pos);
		var result = crc64(crcHigh, crcLow, fileChunk, bytesRead);
		crcHigh = result.high;
		crcLow = result.low;

		pos += bytesRead;
	} while (bytesRead === fileChunk.byteLength);

	fs.closeSync(fd);

	var highPadded = ('0000000' + crcHigh.toString(16)).substr(-8);
	var lowPadded = ('0000000' + crcLow.toString(16)).substr(-8);

	outData[i].hash = highPadded + lowPadded;

	outFile += outData[i].hash + '    ' + outData[i].file + '\n';

	while (progressPos/60 < i/(outData.length-1))
	{
		process.stdout.write('*');
		progressPos++;
	}
}


fs.writeFileSync('./' + outFileName, outFile);
console.log('\n\nDone, see ' + outFileName);