
const pushData = require('../lib/TcpUtil')
const config = require('config')

// const host = '192.168.3.11';
// const host = '47.88.192.69';   //生产环境
// const host = '47.74.154.114';  //开发环境
// const host = '47.74.152.121';  //正式环境
const host = config.na.center     //推送大厅地址
const port = 20003
module.exports = class PushModel {
    pushForzen(obj) {
        const proId = 13; //协议
        return pushData(obj, host, port, proId);
    }
    pushUserBalance(userId, balance) {
        const proId = 8 //协议
        return pushData({ userId, balance }, host, port, proId)
    }
}