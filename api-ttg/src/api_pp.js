// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
// const jwt = require('jsonwebtoken')
const CryptoJS = require("crypto-js")
const querystring = require('querystring')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const ipMap = {}
/**
 * PP 游戏链接
 */
router.get('/pp/gameurl/:gameName/:gameId/:sid/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    let inparam = ctx.params
    let finalUrl = ''
    // 试玩
    if (inparam.userId == 0) {
        finalUrl = `${config.pp.freeLaunchUrl}?lang=zh&cur=CNY&gameSymbol=${inparam.gameName}`
    }
    // 正式
    else {
        // 请求N1服务器是否允许玩家进入游戏
        const nares = await axios.post(config.na.joingameurl, {
            userId: inparam.userId,
            gameId: inparam.gameId,
            sid: inparam.sid,
            token: inparam.token
        })
        if (nares.data.code != 0) {
            log.error(nares.data)
            return ctx.body = { code: nares.data.code, msg: nares.data.msg }
        }
        const ppData = {
            'token': inparam.userId,
            'symbol': inparam.gameName,
            'technology': 'H5',
            'platform': ctx.request.query.lobbyType === 0 ? 'WEB' : 'MOBILE',
            'language': 'zh',
            // 'cashierUrl': `https://${config.na.apidomain}/pp/logout/${inparam.userId}/${inparam.sid}`,
            // 'lobbyUrl': `https://${config.na.apidomain}/pp/logout/${inparam.userId}/${inparam.sid}`
        }
        finalUrl = `${config.pp.launchUrl}?key=${encodeURIComponent(querystring.stringify(ppData))}&stylename=${config.pp.secureLogin}`
    }
    log.info(`登录PP最终链接：${finalUrl}`)
    ctx.redirect(finalUrl)
})

/**
 * PP认证
 * @param {*} token 玩家TOKEN
 */
router.post('/pp/Authenticate', async (ctx, next) => {
    let inparam = ctx.request.body
    if (!hashCheck(inparam)) {
        ctx.body = { userId: 0, currency: 'CNY', cash: 0, bonus: 0, error: 5, description: 'Sign error' }
        return
    }
    let userId = inparam.token
    let player = await new PlayerModel().getPlayerById(userId)
    if (player && !_.isEmpty(player)) {
        ctx.body = { userId: player.userId, currency: 'CNY', cash: player.balance, bonus: 0, error: 0, description: 'Success' }
    } else {
        ctx.body = { userId: 0, currency: 'CNY', cash: 0, bonus: 0, error: 2, description: 'Player not found' }
    }
})

/**
 * PP余额
 * @param {*} token 玩家TOKEN
 */
router.post('/pp/Balance', async (ctx, next) => {
    let inparam = ctx.request.body
    if (!hashCheck(inparam)) {
        ctx.body = { userId: 0, currency: 'CNY', cash: 0, bonus: 0, error: 5, description: 'Sign error' }
        return
    }
    const player = await new PlayerModel().getPlayerById(inparam.userId)
    if (player && !_.isEmpty(player)) {
        ctx.body = { currency: 'CNY', cash: player.balance, bonus: 0, error: 0, description: 'Success' }
    } else {
        ctx.body = { currency: 'CNY', cash: 0, bonus: 0, error: 2, description: 'Player not found' }
    }
})

/**
 * PP下注
 * @param {*} token 玩家TOKEN
 */
router.post('/pp/Bet', async (ctx, next) => {
    let inparam = ctx.request.body
    if (!hashCheck(inparam)) {
        ctx.body = { userId: 0, currency: 'CNY', cash: 0, bonus: 0, error: 5, description: 'Sign error' }
        return
    }
    const player = await new PlayerModel().getPlayerById(inparam.userId)
    let data = {}
    data.billType = 3
    data.gameType = config.pp.gameType
    data.amt = parseFloat(inparam.amount) * -1
    data.businessKey = `BPP_${player.userId}_${inparam.roundId}`         // 设置局号
    data.txnidTemp = `BET_${player.userId}_${inparam.reference}`         // 缓存第三方交易号
    data.anotherGameData = JSON.stringify(inparam)
    data.sourceIP = ipMap[player.userId]                                 // 记录IP
    const amtAfter = await new PlayerModel().updatebalance(player, data)
    if (amtAfter == 'err') {
        ctx.body = {
            transactionId: `APP_${data.txnidTemp}`,
            currency: "CNY",
            cash: player.balance,
            bonus: 0,
            usedPromo: 0,
            error: 1,
            description: "balance not enough"
        }
    } else {
        ctx.body = {
            transactionId: `APP_${data.txnidTemp}`,
            currency: "CNY",
            cash: amtAfter,
            bonus: 0,
            usedPromo: 0,
            error: 0,
            description: "Success"
        }
    }
})

/**
 * PP返奖
 * @param {*} token 玩家TOKEN
 */
router.post('/pp/Result', async (ctx, next) => {
    let inparam = ctx.request.body
    if (!hashCheck(inparam)) {
        ctx.body = { userId: 0, currency: 'CNY', cash: 0, bonus: 0, error: 5, description: 'Sign error' }
        return
    }
    const player = await new PlayerModel().getPlayerById(inparam.userId)
    let data = {}
    data.billType = 4
    data.gameType = config.pp.gameType
    data.amt = parseFloat(Math.abs(inparam.amount))
    data.businessKey = `BPP_${player.userId}_${inparam.roundId}`    // 设置局号
    data.txnidTemp = `WIN_${player.userId}_${inparam.reference}`    // 缓存第三方交易号
    data.anotherGameData = JSON.stringify(inparam)
    data.sourceIP = ipMap[player.userId]                            // 记录IP
    const amtAfter = await new PlayerModel().updatebalance(player, data)
    if (amtAfter == 'err') {
        ctx.body = {
            transactionId: `APP_${data.txnidTemp}`,
            currency: "CNY",
            cash: player.balance,
            bonus: 0,
            usedPromo: 0,
            error: 120,
            description: "bill reject"
        }
    } else {
        ctx.body = {
            transactionId: `APP_${data.txnidTemp}`,
            currency: "CNY",
            cash: amtAfter,
            bonus: 0,
            error: 0,
            description: "Success"
        }
    }
})

/**
 * PP退款
 * @param {*} token 玩家TOKEN
 */
router.post('/pp/Refund', async (ctx, next) => {
    let inparam = ctx.request.body
    if (!hashCheck(inparam)) {
        ctx.body = { userId: 0, currency: 'CNY', cash: 0, bonus: 0, error: 5, description: 'Sign error' }
        return
    }
    if (!inparam.roundId) {
        console.error('退款缺少roundId')
        ctx.body = {
            error: 7,
            description: "roundId error"
        }
    }
    const player = await new PlayerModel().getPlayerById(inparam.userId)
    let data = {}
    data.billType = 5
    data.gameType = config.pp.gameType
    data.amt = parseFloat(Math.abs(inparam.amount))
    data.businessKey = `BPP_${player.userId}_${inparam.roundId}`    // 设置局号
    data.txnidTemp = `RET_${player.userId}_${inparam.reference}`    // 缓存第三方交易号
    data.betsn = `APP_BET_${player.userId}_${inparam.reference}`    // 缓存第三方下注SN
    data.anotherGameData = JSON.stringify(inparam)
    data.sourceIP = ipMap[player.userId]                            // 记录IP
    const amtAfter = await new PlayerModel().updatebalance(player, data)
    if (amtAfter == 'err') {
        ctx.body = {
            transactionId: `APP_${data.txnidTemp}`,
            currency: "CNY",
            cash: player.balance,
            bonus: 0,
            error: 120,
            description: "bill reject"
        }
    } else {
        ctx.body = {
            transactionId: `APP_${data.txnidTemp}`,
            error: 0,
            description: "Success"
        }
    }
})

// /**
//  * 玩家登出
//  * @param {*} userId 玩家ID
//  * @param {*} sid    具体游戏ID
//  */
// router.get('/pp/logout/:userId/:sid', async (ctx, next) => {
//     // log.info(`准备退出玩家【${userId}】`)
//     if (ctx.params.userId == 0) {
//         return ctx.redirect(decodeURIComponent(ctx.request.query.homeurl))
//     }
//     // 请求N1退出
//     let data = {
//         exit: 1,
//         userId: ctx.params.userId,
//         gameType: config.pp.gameType,
//         gameId: ctx.params.sid,
//         timestamp: Date.now()
//     }
//     // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.pp.gameKey}`).toString(CryptoJS.enc.Hex)
//     axios.post(config.na.exiturl, data).then(res => {
//         res.data.code != 0 ? log.error(res.data) : null
//     }).catch(err => {
//         log.error(err)
//     })
//     if (ctx.request.query.homeurl) {
//         ctx.redirect(decodeURIComponent(ctx.request.query.homeurl))
//     } else {
//         ctx.redirect('http://uniwebview.na77.com?key=value&anotherKey=anotherValue')
//     }
// })

function hashCheck(inparam) {
    let sdic = Object.keys(inparam).sort()
    let signBefore = ''
    for (let ki in sdic) {
        if (sdic[ki] != 'hash') {
            signBefore += (`${sdic[ki]}=${inparam[sdic[ki]]}&`)
        }
    }
    signBefore = signBefore.substr(0, signBefore.length - 1)
    signBefore += config.pp.hashKey
    let signAfter = CryptoJS.MD5(signBefore).toString()
    if (signAfter != inparam.hash) {
        console.error(`MD5原始：${signBefore}`)
        console.error(`MD5加密：${signAfter}`)
        console.error(`MD5比对：${inparam.hash}`)
        return false
    }
    return true
}


module.exports = router