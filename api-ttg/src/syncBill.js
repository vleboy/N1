const config = require('config')
const axios = require('axios')
const moment = require('moment')
const SYSTransferModel = require('./model/SYSTransferModel')

async function syncBill(bill) {
    const prefix = bill.name
    const userId = bill.userId
    const method = bill.method
    const type = bill.type
    const betsn = bill.betsn
    const bk = bill.bk
    const sn = bill.sn
    const sourceIP = bill.sourceIP
    const gameType = bill.gameType
    const gameId = bill.gameId
    const inparam = bill.inparam

    // 预置请求数据
    const data = {
        userId: +transaction.userid,
        method,
        amount: Math.abs(+transaction.amt) * -1,
        betsn: betsn ? `${prefix}_${userId}_BET_${betsn}` : null,
        businessKey: `B${prefix}_${userId}_${bk}`,
        sn: `${prefix}_${userId}_${method.toUpperCase()}_${sn}`,
        timestamp: Date.now(),
        sourceIP,
        gameType,
        gameId,
        detail: clearEmpty(inparam)
    }
    // 预置SYSTransfer数据
    let item = {
        ..._.omit(data, ['method', 'timestamp', 'detail']),
        plat: 'YIBO',
        type,
        userId: data.userId.toString(),
        userNick: data.userId.toString(),
        anotherGameData: JSON.stringify(inparam),
        createdAt: data.timestamp,
        createdDate: moment(data.timestamp).utcOffset(8).format('YYYY-MM-DD'),
        createdStr: moment(data.timestamp).utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
    }
    // 向N2同步
    try {
        n2res = await axios.post(config.n2.apiUrl, data)
        if (n2res.data.code == 0) {
            item.status = 'Y'
            item.balance = n2res.data.balance ? +n2res.data.balance : 0
            new SYSTransferModel().putItem(item)
            return { data, balance: n2res.data.balance }
        } else {
            if (n2res.data.code == -1) {
                item.status = 'N'
                item.errorMsg = n2res.data.msg
                item.transferURL = config.n2.apiUrl
                item.repush = data
                new SYSTransferModel().putItem(item)
            } else {
                return { data, balance: n2res.data.balance, err: true }
            }
        }
    } catch (error) {
        item.status = 'E'
        item.transferURL = config.n2.apiUrl
        item.repush = data
        new SYSTransferModel().putItem(item)
    }
}

function clearEmpty(obj) {
    for (let key in obj) {
        if (obj[key] == '') {
            delete obj[key]
        }
    }
    return obj
}

module.exports = syncBill