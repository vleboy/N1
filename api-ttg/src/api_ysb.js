// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
// const jwt = require('jsonwebtoken')
const _ = require('lodash')
const axios = require('axios')
const CryptoJS = require("crypto-js")
const legacy = require('legacy-encoding')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
const HeraGameRecordModel = require('./model/HeraGameRecordModel')
const LogModel = require('./model/LogModel')

/**
 * 检查YSB会员登录接口
 */
router.post('/ysb/login', async function (ctx, next) {
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
        if (prop.$.name == 'UN') {
            UN = prop._.split('_')[1]
        }
        if (prop.$.name == 'SG') {
            SG = prop._
        }
    }
    // 查询玩家
    const player = await new PlayerModel().getPlayerById(UN)
    if (!player || _.isEmpty(player)) {
        S = 104
        ED = '玩家不存在'
    } else {
        // 请求N1服务器是否允许玩家进入游戏
        // log.info(`请求NA平台【POST】${config.na.joingameurl}`)
        // log.info('请求NA平台【参数】' + JSON.stringify({
        //     userId: player.userId,
        //     gameId: config.ysb.gameType,
        //     sid: config.ysb.gameId
        // }))
        const nares = await axios.post(config.na.joingameurl, {
            userId: player.userId,
            gameId: config.ysb.gameType,
            sid: config.ysb.gameId,
            token: SG
        })
        // 根据返回结果是否允许玩家进入游戏
        if (nares.data.code != 0) {
            log.error(nares.data)
            ctx.body = { code: nares.data.code, msg: nares.data.msg }
            S = 104
            ED = nares.data.msg
        }
    }
    ctx.body = getYSBResponse(action, { UN: `NAPL_${UN}`, UID: UN, CC, S, ED })
})

/**
 * YSB唯一接口
 */
router.post('/ysb/postTransfer', async function (ctx, next) {
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
        if (prop.$.name == 'UN') {
            UN = prop._.split('_')[1]
        }
        if (prop.$.name == 'AMT') {
            AMT = +prop._
        }
        if (prop.$.name == 'TRX') {
            TRX = prop._
        }
        if (prop.$.name == 'VID') {
            VID = prop._
        }
        if (prop.$.name == 'PAYAMT') {
            PAYAMT = prop._
        }
        if (prop.$.name == 'REFID') {
            REFID = prop._
        }
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
        ctx.body = getYSBResponse(action, { UN: `NAPL_${UN}`, UID: UN, CC, S, ED })
        return
    }
    inparam.userName = player.userName
    inparam.userId = player.userId
    // 设置玩家余额
    BAL = player.balance
    // 判断交易类型
    switch (action) {
        case 'BET':
            // 设置关键数据，冻结用户金额
            inparam.gameType = config.ysb.gameType                                      // TODO:从配置文件获取游戏类型，未来考虑自动获取
            inparam.amt = parseFloat(AMT) * -1
            inparam.roundId = `CYSB_${UN}_${TRX}`                                       // 设置大局号
            inparam.businessKey = `BYSB_${UN}_${TRX}`                                   // 设置局号
            inparam.billType = 6                                                        // 设置为冻结
            // 下注如果已经存在，则拒绝该条下注
            if (await new PlayerBillDetailModel().isExistBkBet(inparam)) {
                new LogModel().add('3', 'flowerror', inparam, `已存在对应BK【${inparam.businessKey}】的冻结`)
            } else {
                BAL = await new PlayerModel().updatebalance(player, inparam)
            }
            if (BAL == 'err') {
                S = 1016
                ED = '余额不足'
                ctx.body = getYSBResponse(action, { TRX, UN: `NAPL_${UN}`, VID, CC, BAL, S, ED })
            } else {
                ctx.body = getYSBResponse(action, { TRX, UN: `NAPL_${UN}`, VID, CC, BAL, S, ED })
            }
            break;
        case 'BETCONFIRM':
            // 一、设置关键数据，解冻用户金额
            inparam.gameType = config.ysb.gameType                                      // TODO:从配置文件获取游戏类型，未来考虑自动获取
            inparam.roundId = `CYSB_${UN}_${TRX}`                                       // 设置大局号
            inparam.businessKey = `BYSB_${UN}_${TRX}`                                   // 设置局号
            inparam.billType = 5                                                        // 设置为退款解冻
            // 查询出被冻结的金额
            let freezeRecord = await new PlayerBillDetailModel().queryBk({ bk: inparam.businessKey })
            // 如果已经冻结，则先解冻
            if (freezeRecord && freezeRecord.length == 1) {
                inparam.amt = Math.abs(freezeRecord[0].amount)
                BAL = await new PlayerModel().updatebalance(player, inparam)
            }
            // else {
            //     new LogModel().add('3', 'flowerror', inparam, `未找到对应BK【${inparam.businessKey}】的冻结`)
            // }
            // 二、开始执行下注操作
            inparam.billType = 3
            // 遍历所有下注项，每个下注项对应一条下注
            for (let record of Record) {
                if (!record.REFID || isNaN(parseInt(record.REFID))) {
                    continue
                }
                // 设置关键数据，保存流水更新余额
                inparam.amt = parseFloat(record.AMT) * -1
                inparam.roundId = `CYSB_${UN}_${TRX}`                                       // 设置大局号
                inparam.businessKey = `BYSB_${UN}_${record.REFID}`                          // 设置局号
                inparam.anotherGameData = legacy.decode(JSON.stringify(record), 'gb2312')   // 将原始游戏信息JSON格式化存储
                inparam.txnidTemp = `${UN}_${record.REFID}`                                 // 使用第三方ID作为唯一建成分
                // 下注如果已经存在，则拒绝该条下注
                if (await new PlayerBillDetailModel().isExistBkBet(inparam)) {
                    new LogModel().add('3', 'flowerror', inparam, `已存在对应BK【${inparam.businessKey}】的下注`)
                } else {
                    BAL = await new PlayerModel().updatebalance(player, inparam)
                    // 下注写入YSB战绩
                    new HeraGameRecordModel().writeRound({
                        userId: player.userId,
                        userName: player.userName,
                        businessKey: inparam.businessKey,
                        createdAt: Date.now(),
                        gameId: inparam.gameType.toString(),
                        gameType: inparam.gameType,
                        parent: player.parent,
                        status: 3,
                        content: { bet: [], ret: [] },
                        anotherGameData: inparam.anotherGameData
                    })
                }
            }
            ctx.body = getYSBResponse(action, { TRX, UN: `NAPL_${UN}`, CC, BAL, S })
            break;
        case 'PAYOUT':
            inparam.billType = 4
            // 设置关键数据，保存流水更新余额
            inparam.gameType = config.ysb.gameType                                          // TODO:从配置文件获取游戏类型，未来考虑自动获取
            inparam.amt = parseFloat(PAYAMT)
            // if (inparam.amt < 0) {
            //     inparam.billType = 3
            //     log.error('投注有更正，需要记录')                                              // 日志记录YSB投注修正
            // }
            inparam.roundId = `CYSB_${UN}_${TRX}`                                           // 设置大局号
            inparam.businessKey = `BYSB_${UN}_${REFID}`                                     // 设置局号
            inparam.txnidTemp = `${UN}_${TRX}`                                              // 使用第三方ID作为唯一建成分
            // 下注不存在，则拒绝该条返奖
            if (!await new PlayerBillDetailModel().isExistBkBet(inparam)) {
                new LogModel().add('3', 'flowerror', inparam, `未找到对应BK【${inparam.businessKey}】的下注`)
                S = 1013
                ED = '缺少对应下注'
            }
            // 返奖已经存在，则拒绝该条返奖
            else if (await new PlayerBillDetailModel().isExistBkBet(inparam, 4)) {
                new LogModel().add('3', 'flowerror', inparam, `对应BK【${inparam.businessKey}】的返奖已经存在`)
                S = 1013
                ED = '返奖已存在'
            } else {
                BAL = await new PlayerModel().updatebalance(player, inparam)
                // 生成新注单
                new PlayerModel().addRound(player, inparam)
            }
            ctx.body = getYSBResponse(action, { TRX, UN: `NAPL_${UN}`, CC, BAL, S, ED })
            break;
        case 'ACCOUNTBALANCE':
            ctx.body = getYSBResponse(action, { UN: `NAPL_${UN}`, CC, BAL, S })
            break;
        default:
            return
    }
})

/**
 * 网页玩家登出
 * @param {*} userId 玩家ID
 */
router.get('/ysb/logout/:userId/:sid', async function (ctx, next) {
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