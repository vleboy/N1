let net = require('net')

module.exports = function (body, host, port, proId) {
    let client = new net.Socket();
    let buffer = buildPayload(proId, JSON.stringify(body));
    return new Promise((reslove, reject) => {
        // console.log("请求连接NA大厅服务器");
        // console.log(port, host, proId);
        client.connect(port, host, function () {
            client.write(buffer);
        });
        client.on('data', function (data) {
            // console.log(data);
            // console.log(data.readUInt32LE(0,4).toString(10));
            // console.log(data.readUInt32LE(4,8).toString(10));
            let code = +data.readUInt32LE(8, 12).toString(10);
            // 完全关闭连接
            client.destroy();
            // console.log(`连接关闭，返回编码：${code}`);
            if (code != 0) {
                reslove([{ code: code }, 0]);
            } else {
                reslove([null, 0]);
            }
        });
        client.on("error", function (err) {
            console.error('大厅无响应，请检查大厅服务器是否正常！')
            // setTimeout(function () {
            //     push(body, host, port, proId);
            // }, 10 * 60 * 1000);
        })
    })
}

let buildPayload = function (protocalId, data) {
    let dataBuffer = Buffer.from(data, 'utf8')
    let dataLength = dataBuffer.length
    let payloadLengthBuff = Buffer.alloc(4)  // 数据总长度buff
    let protocalLengthBuff = Buffer.alloc(4) // 协议长度buff
    let dataLengthBuff = Buffer.alloc(4)
    let payloadLength = 4 * 3 + dataLength

    payloadLengthBuff.writeInt32LE(payloadLength)
    protocalLengthBuff.writeInt32LE(protocalId)
    dataLengthBuff.writeInt32LE(dataLength)

    return Buffer.concat([payloadLengthBuff, protocalLengthBuff, dataLengthBuff, dataBuffer])
}
let buildNumber = function (protocalId, number) {
    let payloadLengthBuff = Buffer.alloc(4)  // 数据总长度buff
    let protocalLengthBuff = Buffer.alloc(4) // 协议长度buff
    let dataLengthBuff = Buffer.alloc(4) // data buff
    let payloadLength = 4 * 3
    payloadLengthBuff.writeInt32LE(payloadLength)
    protocalLengthBuff.writeInt32LE(protocalId)
    dataLengthBuff.writeInt32LE(number)
    return Buffer.concat([payloadLengthBuff, protocalLengthBuff, dataLengthBuff])
}

