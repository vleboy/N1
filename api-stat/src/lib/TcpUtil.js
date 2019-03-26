var net = require('net')

const pushUserInfo = (body, host, port, proId) => {
    let client = new net.Socket();
    let buffer = buildPayload(proId, JSON.stringify(body));
    return new Promise((reslove, reject) => {
        console.log("请求连接");
        console.log(port, host, proId);
        client.connect(port, host, function () {
            client.write(buffer);
        });
        client.on('data', function (data) {
            // console.log(data.readUInt32LE(0,4).toString(10));
            // console.log(data.readUInt32LE(4,8).toString(10));
            let code = +data.readUInt32LE(8, 12).toString(10);
            // 完全关闭连接
            client.destroy();
            console.log("code");
            console.log(code);
            if (code != '0') {
                reslove([{ code: code }, 0]);
            } else {
                reslove([null, 0]);
            }
        });
        client.on("error", function (err) {
            setTimeout(function () {
                pushUserInfo(body, host, port, proId);
            }, 10 * 60 * 1000);
        })
    })
}
const pushId = (id, host, port, proId) => {
    return pushUserBalance(id, host, port, proId);
}
const pushUserBalance = (userId, host, port, proId) => {
    let client = new net.Socket();
    let buffer;
    if (typeof userId == "number") {
        buffer = buildNumber(proId, userId);
    } else {
        buffer = buildPayload(proId, userId);
    }
    return new Promise((reslove, reject) => {
        console.log("请求连接");
        console.log(port, host, proId);
        client.connect(port, host, function () {
            client.write(buffer);
        });
        client.on('data', function (data) {
            // console.log(data.readUInt32LE(0,4).toString(10));
            // console.log(data.readUInt32LE(4,8).toString(10));
            let code = +data.readUInt32LE(8, 12).toString(10);
            // 完全关闭连接
            client.destroy();
            console.log(`code：${code}`);
            if (code != '0') {
                reslove([{ code: code }, 0]);
            } else {
                reslove([null, 0]);
            }
        });
        client.on("error", function (err) {
            setTimeout(function () {
                pushUserBalance(userId, host, port, proId);
            }, 10 * 60 * 60 * 1000);
        })
    })
}

var buildPayload = function (protocalId, data) {
    var dataBuffer = Buffer.from(data, 'utf8')
    var dataLength = dataBuffer.length
    var payloadLengthBuff = Buffer.alloc(4)  // 数据总长度buff
    var protocalLengthBuff = Buffer.alloc(4) // 协议长度buff
    var dataLengthBuff = Buffer.alloc(4)
    var payloadLength = 4 * 3 + dataLength

    payloadLengthBuff.writeInt32LE(payloadLength)
    protocalLengthBuff.writeInt32LE(protocalId)
    dataLengthBuff.writeInt32LE(dataLength)


    return Buffer.concat([payloadLengthBuff, protocalLengthBuff, dataLengthBuff, dataBuffer])

}
var buildNumber = function (protocalId, number) {
    var payloadLengthBuff = Buffer.alloc(4)  // 数据总长度buff
    var protocalLengthBuff = Buffer.alloc(4) // 协议长度buff
    var dataLengthBuff = Buffer.alloc(4) // data buff
    var payloadLength = 4 * 3
    payloadLengthBuff.writeInt32LE(payloadLength)
    protocalLengthBuff.writeInt32LE(protocalId)
    dataLengthBuff.writeInt32LE(number)
    return Buffer.concat([payloadLengthBuff, protocalLengthBuff, dataLengthBuff])
}

// pushUserInfo(BuildPayload(9,JSON.stringify({a:1,b:"汉字"})));

module.exports = {
    pushUserInfo,
    pushId,
    pushUserBalance
}