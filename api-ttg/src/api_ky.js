// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const moment = require('moment')
const crypto = require('crypto')
const qs = require('querystring')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
const LogModel = require('./model/LogModel')
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const ipMap = {}

/**
 * 玩家上线
 * @param {*} gameId NA游戏大类
 * @param {*} sid NA游戏ID
 * @param {*} userId NA玩家ID，0是试玩
 * @param {*} token NA玩家TOKEN，0是试玩
 * @param {*} lobbyType 0是电脑版，1是移动版 */
router.get('/ky/gameurl/:gameId/:sid/:userId/:token', async (ctx, next) => {
    let ip = ipMap[ctx.params.userId] = ctx.request.ip
    const inparam = ctx.params
    // 请求N1服务器是否允许玩家进入游戏
    const nares = await axios.post(config.na.joingameurl, {
        userId: inparam.userId,
        gameId: inparam.gameId,
        sid: inparam.sid,
        token: inparam.token
    })
    if (nares.data.code != 0) {
        return ctx.body = { code: nares.data.code, msg: nares.data.msg }
    }
    const lineCode = inparam.lineCode || 'NA'                                                                     //代理下面的站点标识
    const account = inparam.userId                                                                                //玩家账号
    const orderid = `${config.ky.agent}${moment().utcOffset(8).format("YYYYMMDDHHmmssSSS")}${account}`            //流水号
    // 查询获取玩家余额
    const player = await new PlayerModel().getPlayerById(account)
    let money = player.balance
    // 查询玩家是否已经上分，如果已经上分，则不需要重复上分
    let res = await axios.get(getURL(1, `s=1&account=${account}`))
    if (+res.data.d.money > 0) {
        money = 0
    }
    // 无需上分，直接进入
    if (money == 0) {
        res = await axios.get(getURL(0, `s=0&account=${account}&money=${money}&lineCode=${lineCode}&ip=${ip}&orderid=${orderid}&KindId=0`))
        return ctx.redirect(res.data.d.url)
    }
    // 上分，必须先模拟下注
    const txnidTemp = `${account}_BET_${orderid}`
    const updateParams = { billType: 3 }
    updateParams.amt = money * -1
    updateParams.gameType = config.ky.gameType
    updateParams.businessKey = `BKY_${account}_${orderid}`
    updateParams.txnidTemp = txnidTemp
    updateParams.sourceIP = ipMap[player.userId]
    let amtAfter = await new PlayerModel().updatebalance(player, updateParams)
    if (amtAfter == 'err') {
        ctx.body = { code: -1, msg: "游戏状态错误" }
    } else {
        // 获取游戏URL，上分
        let checkRes = true
        let res = false
        try {
            res = await axios.get(getURL(0, `s=0&account=${account}&money=${money}&lineCode=${lineCode}&ip=${ip}&orderid=${orderid}&KindId=0`))
        } catch (error) {
            checkRes = await checkOrder(orderid)
        }
        // 上分成功，进入游戏
        if (checkRes && res && res.data.d.code == 0) {
            ctx.redirect(res.data.d.url)
        }
        // 上分失败，退款 
        else {
            const updateParams2 = { billType: 5 }
            updateParams2.amt = money
            updateParams2.gameType = config.ky.gameType
            updateParams2.businessKey = `BKY_${account}_${orderid}`
            updateParams2.betsn = `AKY_${txnidTemp}`
            updateParams2.txnidTemp = `${account}_BETCANCEL_${orderid}`
            updateParams2.sourceIP = ipMap[player.userId]
            let amtAfter = await new PlayerModel().updatebalance(player, updateParams2)
            if (amtAfter == 'err') {
                new LogModel().add('2', 'KYUPError', updateParams2, `KY退款失败${orderid}`)
            }
            ctx.body = { code: -1, msg: res.data.d }
        }
    }
})

/**
 * 玩家下线（提供给ky的回调通知）
 */
router.get('/ky/logout', async (ctx, next) => {
    // 获取入参
    const account = qs.parse(desDecode(config.ky.desKey, decodeURIComponent(ctx.request.query.param))).account.split('_')[1]
    log.info(`玩家${account}离线下分`)
    // 获取玩家可下分金额
    let res = await axios.get(getURL(1, `s=1&account=${account}`))
    const money = parseFloat(res.data.d.money)
    if (!money) {
        return ctx.body = { s: 101, m: "/channelHandle", d: { code: 0 } }
    }
    // 全部下分
    let checkRes = true
    const orderid = `${config.ky.agent}${moment().utcOffset(8).format("YYYYMMDDHHmmssSSS")}${account}`
    try {
        res = await axios.get(getURL(3, `s=3&account=${account}&money=${money}&orderid=${orderid}`))
    } catch (error) {
        checkRes = await checkOrder(orderid)
    }
    if (checkRes && res.data.d.code == 0) {
        //模拟下注0
        let player = await new PlayerModel().getPlayerById(account)
        const txnidTemp = `${account}_BET_${orderid}`
        const updateParams1 = { billType: 3 }
        updateParams1.amt = 0
        updateParams1.gameType = config.ky.gameType
        updateParams1.businessKey = `BKY_${account}_${orderid}`
        updateParams1.txnidTemp = txnidTemp
        updateParams1.sourceIP = ipMap[player.userId]
        let amtAfter = await new PlayerModel().updatebalance(player, updateParams1)
        if (amtAfter == 'err') {
            new LogModel().add('2', 'KYDOWNError', updateParams1, `KY下分投注0失败${orderid}`)
            return ctx.body = { s: 101, m: "/channelHandle", d: { code: 27 } }
        }
        //模拟返奖
        const updateParams2 = { billType: 4 }
        updateParams2.amt = money
        updateParams2.gameType = config.ky.gameType
        updateParams2.businessKey = `BKY_${account}_${orderid}`
        updateParams2.betsn = `AKY_${txnidTemp}`
        updateParams2.sourceIP = ipMap[player.userId]
        amtAfter = await new PlayerModel().updatebalance(player, updateParams2)
        if (amtAfter == 'err') {
            new LogModel().add('2', 'KYDOWNError', updateParams2, `KY下分返奖失败${orderid}`)
            return ctx.body = { s: 101, m: "/channelHandle", d: { code: 27 } }
        }
        // 请求N1退出
        axios.post(config.na.exiturl, {
            exit: 1,
            userId: account,
            gameType: config.ky.gameType,
            gameId: config.ky.gameId,
            timestamp: Date.now()
        }).then(res => {
            res.data.code != 0 ? log.error(res.data) : null
        }).catch(err => {
            log.error(err)
        })
        ctx.body = { s: 101, m: "/channelHandle", d: { code: 0 } }
    } else {
        new LogModel().add('2', 'KYDOWNError', { userId: account, userName: account }, `KY下分异常${orderid}`)
        ctx.body = { s: 101, m: "/channelHandle", d: { code: res.data.d.code } }
    }
})

/**
 * 获取游戏注单（30秒拉取一次）
 */
router.get('/ky/betdetail', async (ctx, next) => {
    //获取入参
    let inparam = ctx.request.query
    try {
        let res = await axios.get(getURL(6, `s=6&startTime=${inparam.startTime}&endTime=${inparam.endTime}`))
        ctx.body = res.data.d
    } catch (error) {
        new LogModel().add('2', 'KYRecordError', { userId: '-1', userName: '-1' }, `KY获取游戏注单异常&startTime=${inparam.startTime}&endTime=${inparam.endTime}`)
        ctx.body = { code: -1, err: res.data }
    }
})

/**
 * 查询/踢玩家下线接口
 * @param s 操作类型 1：查询玩家可下分余额 5：查询玩家是否在线 7：查询游戏总余额 8：根据玩家账号提玩家下线
 * @param account 玩家账号
 */
router.get('/ky/:s/:account', async (ctx, next) => {
    //获取入参
    let inparam = ctx.params
    let account = inparam.account
    //获取请求url
    let res = await axios.get(getURL(parseInt(inparam.s), `s=${inparam.s}&account=${account}`))
    //根据操作类型做相应处理
    if (res.data.d.code == 0) {
        switch (parseInt(inparam.s)) {
            case 1://查询玩家可下分余额
                ctx.body = { code: 0, msg: "success", money: res.data.d.money }
                break;
            case 5://查询玩家是否在线
                ctx.body = { code: 0, msg: "success", status: res.data.d.status }
                break;
            case 7://查询游戏总余额
                ctx.body = { code: 0, msg: "success", totalMoney: res.data.d.totalMoney, freeMoney: res.data.d.freeMoney }
                break;
            case 8://根据玩家账号提玩家下线
                ctx.body = { code: 0, msg: "success" }
                break;
        }
    } else {
        ctx.body = { code: -1, msg: res.data }
    }
})

// /**
//  * 上分/下分接口(一般情况下禁用)
//  * @param s 操作类型 2：上分 3：下分
//  * @param account 玩家账号
//  */
// router.get('/ky/:s/:account/:money', async (ctx, next) => {
//     //获取入参
//     let inparam = ctx.params
//     let account = inparam.account
//     let money = inparam.money
//     //获取请求url
//     const orderid = `${config.ky.agent}${moment().utcOffset(8).format("YYYYMMDDHHmmssSSS")}${account}`
//     let res = await axios.get(getURL(parseInt(inparam.s), `s=${inparam.s}&account=${account}&money=${money}&orderid=${orderid}`))
//     //根据操作类型做相应处理
//     if (res.data.d.code == 0) {
//         switch (parseInt(inparam.s)) {
//             case 2://上分
//                 ctx.body = { code: 0, msg: "success", money: res.data.d.money }
//                 break;
//             case 3://下分
//                 ctx.body = { code: 0, msg: "success", status: res.data.d.status }
//                 break;
//         }
//     } else {
//         ctx.body = { code: -1, msg: res.data }
//     }
// })

// 间隔5秒请求一次订单状态，直到确认返回
async function checkOrder(orderid) {
    try {
        const res = await axios.get(getURL(0, `s=4&orderid=${orderid}`))
        if (res.data.d.code == 0) {
            if (res.data.d.status == 0) {
                return true
            }
            if (res.data.d.status == -1 || res.data.d.status == 2) {
                return false
            }
            if (res.data.d.status == 3) {
                checkOrder(orderid)
            }
        } else {
            log.error(`KY棋牌检查订单${orderid}异常`)
            checkOrder(orderid)
        }
    } catch (error) {
        log.error(`KY棋牌检查订单${orderid}超时`)
        setTimeout(() => {
            checkOrder(orderid)
        }, 5000)
    }
}
// 组装获取请求的url
function getURL(s, param) {
    let timestamp = Date.now()
    let url = s != 6 ? config.ky.apiUrl : config.ky.recordUrl
    url = url + "?" + qs.stringify({
        agent: config.ky.agent,
        timestamp: timestamp,
        param: desEncode(config.ky.desKey, param),
        key: crypto.createHash('md5').update(config.ky.agent + timestamp.toString() + config.ky.md5key).digest('hex'),
    })
    return url
}
// DES解密
function desDecode(desKey, data) {
    var cipherChunks = [];
    var decipher = crypto.createDecipheriv('aes-128-ecb', desKey, '');
    decipher.setAutoPadding(true);
    cipherChunks.push(decipher.update(data, 'base64', 'utf8'));
    cipherChunks.push(decipher.final('utf8'));
    return cipherChunks.join('');
}
// DES加密
function desEncode(desKey, data) {
    var cipherChunks = [];
    var cipher = crypto.createCipheriv('aes-128-ecb', desKey, '');
    cipher.setAutoPadding(true);
    cipherChunks.push(cipher.update(data, 'utf8', 'base64'));
    cipherChunks.push(cipher.final('base64'));

    return cipherChunks.join('');
}

module.exports = router