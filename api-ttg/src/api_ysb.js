// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const CryptoJS = require("crypto-js")
// const jwt = require('jsonwebtoken')
// const legacy = require('legacy-encoding')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
const HeraGameRecordModel = require('./model/HeraGameRecordModel')
const ipMap = {}
const gameIdMap = {}

// 免转接出-YSB游戏连接
router.get('/ysb/:gameId/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    gameIdMap[ctx.params.userId] = ctx.params.gameId
    const inparam = ctx.params
    // 请求N2服务器是否允许玩家进入游戏
    const nares = await axios.post(config.n2.apiUrl, { userId: inparam.userId, method: 'auth' })
    if (nares.data.code != 0) {
        return ctx.body = { code: nares.data.code, msg: nares.data.msg }
    }
    ctx.redirect(`${config.ysb.gameurl}&username=NAPL_${ctx.params.userId}&sign=${ctx.params.token}`)
})

// 免转接出-YSB登录
router.post('/ysb/login', async (ctx, next) => {
    // 获取入参
    let action = ctx.request.body.request.$.action
    let inparam = ctx.request.body.request.element[0]
    let UN = null
    let SG = null
    let CC = 0
    let S = 0
    let ED = ''
    // log.info(action)
    // log.info(JSON.stringify(inparam))
    for (let prop of inparam.properties) {
        UN = prop.$.name == 'UN' ? prop._.split('_')[1] : UN
        SG = prop.$.name == 'SG' ? prop._ : SG
    }
    if (UN.length == 8) {
        ctx.body = getYSBResponse(action, { UN: `NAPL_${UN}`, UID: UN, CC, S, ED })
    } else {
        return next()
    }
})

/**
 * YSB唯一接口
 */
router.post('/ysb/postTransfer', async (ctx, next) => {
    // 获取入参
    let action = ctx.request.body.request.$.action
    let inparam = ctx.request.body.request.element[0]
    let UN = null
    let AMT = null
    let TRX = null
    let VID = null
    let REFID = null
    let CC = 'RMB'
    let BAL = 0
    let S = 0
    let ED = ''
    let PAYAMT = 0
    let Record = []
    // log.info(action)
    // log.info(JSON.stringify(inparam))
    for (let prop of inparam.properties) {
        UN = prop.$.name == 'UN' ? prop._.split('_')[1] : UN
        AMT = prop.$.name == 'AMT' ? prop._ : AMT
        TRX = prop.$.name == 'TRX' ? prop._ : TRX
        VID = prop.$.name == 'VID' ? prop._ : VID
        PAYAMT = prop.$.name == 'PAYAMT' ? prop._ : PAYAMT
        REFID = prop.$.name == 'REFID' ? prop._ : REFID
    }
    if (UN.length == 8) {
        // 转换Record的XML对象为JSON对象
        if (inparam.Record && inparam.Record.length > 0) {
            for (let record of inparam.Record) {
                let obj = {}
                for (let item of record.properties) {
                    obj[item.$.name] = item._
                }
                Record.push(obj)
            }
            // log.info(JSON.stringify(Record))
        }
        // 查询玩家
        let n2res = await axios.post(config.n2.apiUrl, { userId: UN, method: 'balance' })
        if (n2res.data.code != 0) {
            return ctx.body = getYSBResponse(action, { UN: `NAPL_${UN}`, UID: UN, CC: 0, S: 104, ED: '玩家不存在' })
        }
        BAL = n2res.data.balance
        // inparam.userName = player.userName
        // inparam.userId = player.userId
        // inparam.gameType = config.ysb.gameType
        // inparam.roundId = TRX ? `CYSB_${UN}_${TRX}` : inparam.roundId
        // 判断交易类型
        switch (action) {
            case 'ACCOUNTBALANCE':
                ctx.body = getYSBResponse(action, { UN: `NAPL_${UN}`, CC, BAL, S })
                break;
            case 'BET':
                inparam.billType = 6                                                        // 设置为冻结
                inparam.amt = parseFloat(AMT) * -1
                inparam.businessKey = `BYSB_${UN}_${TRX}`
                inparam.txnidTemp = `${UN}_BET_${TRX}`
                BAL = await new PlayerModel().updatebalance(player, inparam)
                if (BAL == 'err') {
                    S = 1016
                    ED = '余额不足'
                } else if (BAL == player.balance) {
                    S = 1016
                    ED = '重复投注'
                    console.error(`重复投注:${inparam.businessKey}`)
                }
                ctx.body = getYSBResponse(action, { TRX, UN: `NAPL_${UN}`, VID, CC, BAL, S, ED })
                break;
            case 'BETCONFIRM':
                // 查询出被冻结的金额
                let freezeRecord = await new PlayerBillDetailModel().getBill(`AYSB_${UN}_BET_${TRX}`)
                // 如果已经冻结，则先解冻
                if (freezeRecord.Item && !_.isEmpty(freezeRecord.Item)) {
                    inparam.billType = 5                                                   // 设置为解冻
                    inparam.amt = Math.abs(freezeRecord.Item.amount)
                    inparam.businessKey = `BYSB_${UN}_${TRX}`
                    inparam.txnidTemp = `${UN}_UNBET_${TRX}`
                    inparam.betsn = `AYSB_${UN}_BET_${TRX}`
                    BAL = await new PlayerModel().updatebalance(player, inparam)
                    player.balance = BAL
                }
                // 遍历所有下注项，每个下注项对应一条下注
                for (let record of Record) {
                    if (!record.REFID || isNaN(parseInt(record.REFID))) {
                        continue
                    }
                    inparam.billType = 3
                    inparam.amt = parseFloat(record.AMT) * -1
                    inparam.businessKey = `BYSB_${UN}_${record.REFID}`
                    inparam.txnidTemp = `${UN}_BETCONFIRM_${record.REFID}`
                    inparam.anotherGameData = JSON.stringify(record)                      // 将原始游戏信息JSON格式化存储
                    BAL = await new PlayerModel().updatebalance(player, inparam)
                    // 下注写入YSB战绩，以便提供实时查询，status==3不会提供给商户查询，PAYOUT后会根据主键覆盖
                    new HeraGameRecordModel().writeRound({
                        userId: player.userId,
                        userName: player.userName,
                        businessKey: inparam.businessKey,
                        gameId: inparam.gameType.toString(),
                        gameType: inparam.gameType,
                        parent: player.parent,
                        status: 3,
                        content: { bet: [], ret: [] },
                        anotherGameData: inparam.anotherGameData,
                        createdAt: Date.now()
                    })
                }
                ctx.body = getYSBResponse(action, { TRX, UN: `NAPL_${UN}`, CC, BAL, S })
                break;
            case 'PAYOUT':
                inparam.billType = 4
                inparam.amt = parseFloat(PAYAMT)
                inparam.businessKey = `BYSB_${UN}_${REFID}`
                inparam.txnidTemp = `${UN}_PAYOUT_${REFID}`
                inparam.betsn = `AYSB_${UN}_BETCONFIRM_${REFID}`
                inparam.txnid = TRX
                // 检查派彩调整是否正确
                if (!await new PlayerBillDetailModel().ysbPayoutCheck(inparam)) {
                    S = 1013
                    ED = '返奖已存在'
                } else {
                    BAL = await new PlayerModel().updatebalance(player, inparam)
                    if (BAL == player.balance) {
                        S = 1013
                        ED = '返奖已存在'
                    } else {
                        new PlayerModel().addRound(inparam)
                    }
                }
                ctx.body = getYSBResponse(action, { TRX, UN: `NAPL_${UN}`, CC, BAL, S, ED })
                break;
            default:
                return
        }
    } else {
        return next()
    }
})


/**
 * 检查YSB会员登录接口
 */
router.post('/ysb/login', async (ctx, next) => {
    // 获取入参
    let action = ctx.request.body.request.$.action
    let inparam = ctx.request.body.request.element[0]
    let UN = null
    let SG = null
    let CC = 0
    let S = 0
    let ED = ''
    // log.info(action)
    // log.info(JSON.stringify(inparam))
    for (let prop of inparam.properties) {
        UN = prop.$.name == 'UN' ? prop._.split('_')[1] : UN
        SG = prop.$.name == 'SG' ? prop._ : SG
    }
    const nares = await axios.post(config.na.joingameurl, {
        userId: +UN,
        gameId: config.ysb.gameType,
        sid: config.ysb.gameId,
        token: SG
    })
    // 根据返回结果是否允许玩家进入游戏
    if (nares.data.code != 0) {
        log.error(nares.data)
        S = 104
        ED = '无效玩家'
    }
    ctx.body = getYSBResponse(action, { UN: `NAPL_${UN}`, UID: UN, CC, S, ED })
})

/**
 * YSB唯一接口
 */
router.post('/ysb/postTransfer', async (ctx, next) => {
    // 获取入参
    let action = ctx.request.body.request.$.action
    let inparam = ctx.request.body.request.element[0]
    let UN = null
    let AMT = null
    let TRX = null
    let VID = null
    let REFID = null
    let CC = 'RMB'
    let BAL = 0
    let S = 0
    let ED = ''
    let PAYAMT = 0
    let Record = []
    // log.info(action)
    // log.info(JSON.stringify(inparam))
    for (let prop of inparam.properties) {
        UN = prop.$.name == 'UN' ? prop._.split('_')[1] : UN
        AMT = prop.$.name == 'AMT' ? prop._ : AMT
        TRX = prop.$.name == 'TRX' ? prop._ : TRX
        VID = prop.$.name == 'VID' ? prop._ : VID
        PAYAMT = prop.$.name == 'PAYAMT' ? prop._ : PAYAMT
        REFID = prop.$.name == 'REFID' ? prop._ : REFID
    }
    // 转换Record的XML对象为JSON对象
    if (inparam.Record && inparam.Record.length > 0) {
        for (let record of inparam.Record) {
            let obj = {}
            for (let item of record.properties) {
                obj[item.$.name] = item._
            }
            Record.push(obj)
        }
        // log.info(JSON.stringify(Record))
    }
    // 查询玩家
    const player = await new PlayerModel().getPlayerById(UN)
    if (!player || _.isEmpty(player)) {
        CC = 0
        S = 104
        ED = '玩家不存在'
        return ctx.body = getYSBResponse(action, { UN: `NAPL_${UN}`, UID: UN, CC, S, ED })
    }
    inparam.userName = player.userName
    inparam.userId = player.userId
    inparam.gameType = config.ysb.gameType
    inparam.roundId = TRX ? `CYSB_${UN}_${TRX}` : inparam.roundId
    BAL = player.balance
    // 判断交易类型
    switch (action) {
        case 'ACCOUNTBALANCE':
            ctx.body = getYSBResponse(action, { UN: `NAPL_${UN}`, CC, BAL, S })
            break;
        case 'BET':
            inparam.billType = 6                                                        // 设置为冻结
            inparam.amt = parseFloat(AMT) * -1
            inparam.businessKey = `BYSB_${UN}_${TRX}`
            inparam.txnidTemp = `${UN}_BET_${TRX}`
            BAL = await new PlayerModel().updatebalance(player, inparam)
            if (BAL == 'err') {
                S = 1016
                ED = '余额不足'
            } else if (BAL == player.balance) {
                S = 1016
                ED = '重复投注'
                console.error(`重复投注:${inparam.businessKey}`)
            }
            ctx.body = getYSBResponse(action, { TRX, UN: `NAPL_${UN}`, VID, CC, BAL, S, ED })
            break;
        case 'BETCONFIRM':
            // 查询出被冻结的金额
            let freezeRecord = await new PlayerBillDetailModel().getBill(`AYSB_${UN}_BET_${TRX}`)
            // 如果已经冻结，则先解冻
            if (freezeRecord.Item && !_.isEmpty(freezeRecord.Item)) {
                inparam.billType = 5                                                   // 设置为解冻
                inparam.amt = Math.abs(freezeRecord.Item.amount)
                inparam.businessKey = `BYSB_${UN}_${TRX}`
                inparam.txnidTemp = `${UN}_UNBET_${TRX}`
                inparam.betsn = `AYSB_${UN}_BET_${TRX}`
                BAL = await new PlayerModel().updatebalance(player, inparam)
                player.balance = BAL
            }
            // 遍历所有下注项，每个下注项对应一条下注
            for (let record of Record) {
                if (!record.REFID || isNaN(parseInt(record.REFID))) {
                    continue
                }
                inparam.billType = 3
                inparam.amt = parseFloat(record.AMT) * -1
                inparam.businessKey = `BYSB_${UN}_${record.REFID}`
                inparam.txnidTemp = `${UN}_BETCONFIRM_${record.REFID}`
                inparam.anotherGameData = JSON.stringify(record)                      // 将原始游戏信息JSON格式化存储
                BAL = await new PlayerModel().updatebalance(player, inparam)
                // 下注写入YSB战绩，以便提供实时查询，status==3不会提供给商户查询，PAYOUT后会根据主键覆盖
                new HeraGameRecordModel().writeRound({
                    userId: player.userId,
                    userName: player.userName,
                    businessKey: inparam.businessKey,
                    gameId: inparam.gameType.toString(),
                    gameType: inparam.gameType,
                    parent: player.parent,
                    status: 3,
                    content: { bet: [], ret: [] },
                    anotherGameData: inparam.anotherGameData,
                    createdAt: Date.now()
                })
            }
            ctx.body = getYSBResponse(action, { TRX, UN: `NAPL_${UN}`, CC, BAL, S })
            break;
        case 'PAYOUT':
            inparam.billType = 4
            inparam.amt = parseFloat(PAYAMT)
            inparam.businessKey = `BYSB_${UN}_${REFID}`
            inparam.txnidTemp = `${UN}_PAYOUT_${REFID}`
            inparam.betsn = `AYSB_${UN}_BETCONFIRM_${REFID}`
            inparam.txnid = TRX
            // 检查派彩调整是否正确
            if (!await new PlayerBillDetailModel().ysbPayoutCheck(inparam)) {
                S = 1013
                ED = '返奖已存在'
            } else {
                BAL = await new PlayerModel().updatebalance(player, inparam)
                if (BAL == player.balance) {
                    S = 1013
                    ED = '返奖已存在'
                } else {
                    new PlayerModel().addRound(inparam)
                }
            }
            ctx.body = getYSBResponse(action, { TRX, UN: `NAPL_${UN}`, CC, BAL, S, ED })
            break;
        default:
            return
    }
})

/**
 * 网页玩家登出
 * @param {*} userId 玩家ID
 */
router.get('/ysb/logout/:userId/:sid', async (ctx, next) => {
    // 请求N1退出
    let data = {
        exit: 1,
        userId: ctx.params.userId,
        gameType: config.ysb.gameType,
        gameId: ctx.params.sid,
        timestamp: Date.now()
    }
    // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.ysb.gameKey}`).toString(CryptoJS.enc.Hex)
    axios.post(config.na.exiturl, data).then(res => {
        res.data.code != 0 ? log.error(res.data) : null
    }).catch(err => {
        log.error(err)
    })
    ctx.body = { code: 0, msg: '退出成功' }
})

// 私有方法：获取YSB返回值
function getYSBResponse(action, data) {
    let hp = `${action}`
    let res = `<?xml version="1.0" encoding="UTF-8"?><response action="${action}"><element id="id001">`
    if (action != 'clogin') {
        res = `<?xml version="1.0" encoding="UTF-8"?><response action="${action}"><element>`
    }
    for (let key in data) {
        res += `<properties name="${key}">${data[key]}</properties>`
        if (key != 'ED') {
            hp += `|${data[key]}`
        }
    }
    hp += `|${config.ysb.vendorSecretkey}`
    // log.info(hp)
    if (action != 'clogin') {
        res += `<properties name="HP">${CryptoJS.MD5(hp).toString().toUpperCase()}</properties>`
    }
    res += '</element></response>'
    // log.info(`返回YSB【结果】${res}`)
    return res
}

module.exports = router