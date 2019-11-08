// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const CryptoJS = require("crypto-js")
const syncBill = require('./syncBill')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const ipMap = {}
const gameIdMap = {}

// 免转接出-dj游戏链接
router.get('/dj/:gameId/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    gameIdMap[ctx.params.userId] = ctx.params.gameId
    const inparam = ctx.params
    let source = ctx.request.query.lobbyType || '1'
    // 请求N2服务器是否允许玩家进入游戏
    const n2res = await axios.post(config.n2.apiUrl, { userId: inparam.userId, method: 'auth' }, { headers: { 'token': ctx.params.token } })
    if (n2res.data.code != 0) {
        return ctx.body = { code: n2res.data.code, msg: n2res.data.msg }
    }
    const player = {
        userId: inparam.userId,
        regMap: n2res.data.regMap,
        balance: n2res.data.balance
    }
    if (!player.regMap || !player.regMap.dj) {
        let res = await postDJ('create_user', { account: player.userId, userName: player.userId, pwd: '123456' })
        if (res.data.code == 1 || res.data.code == -4) {
            player.regMap ? player.regMap.dj = 1 : player.regMap = { dj: 1 }
            player.method = 'update'
            axios.post(config.n2.apiUrl, player)
        } else {
            return ctx.body = res.data
        }
    }
    // 登录游戏
    let res = await postDJ('login', { account: player.userId, pwd: '123456', language: "0", source })
    ctx.redirect(res.data.retobj.url)
})
// 免转接出-dj获取玩家余额
router.post('/dj/query_user_credit', async (ctx, next) => {
    const inparam = ctx.request.body
    if (inparam.account.length == 8) {
        const nares = await axios.post(config.n2.apiUrl, { userId: inparam.account, method: 'balance' })
        if (nares.data.code != 0) {
            return ctx.body = { code: -2, errmsg: "玩家不存在" }
        } else {
            ctx.body = { code: 1, errmsg: "", retobj: { account: inparam.account, credit: nares.data.balance.toString() } }
        }
    } else {
        return next()
    }
})
// 免转接出-dj玩家下注
router.post('/dj/bet', async (ctx, next) => {
    const inparam = ctx.request.body
    const userId = inparam.account
    if (userId.length == 8) {
        // 预置数据
        const bill = {
            prefix: 'DJ',
            userId: +userId,
            method: 'bet',
            type: 3,
            amount: Math.abs(+inparam.betAmount) * -1,
            betsn: null,
            bk: inparam.orderNo,
            sn: inparam.orderNo,
            sourceIP: ipMap[userId],
            gameType: +config.dj.gameType,
            gameId: gameIdMap[userId] ? +gameIdMap[userId] : +config.dj.gameType,
            inparam
        }
        // 向N2同步
        let syncRes = await syncBill(bill)
        if (syncRes) {
            if (!syncRes.err) {
                ctx.body = { code: 1, errmsg: "", retobj: { transNo: syncRes.data.sn, credit: syncRes.balance.toString() } }
            } else {
                ctx.body = { code: -3, errmsg: "投注失败" }
            }
        }
    } else {
        return next()
    }
})

// 免转接出-dj玩家返还
router.post('/dj/prize', async (ctx, next) => {
    const inparam = ctx.request.body
    const userId = inparam.account
    if (inparam.account.length == 8) {
        // 预置数据
        const bill = {
            prefix: 'DJ',
            userId: +userId,
            method: 'win',
            type: 4,
            amount: Math.abs(+inparam.prizeAmount),
            betsn: inparam.orderNo,
            bk: inparam.orderNo,
            sn: inparam.orderNo,
            sourceIP: ipMap[userId],
            gameType: +config.dj.gameType,
            gameId: gameIdMap[userId] ? +gameIdMap[userId] : +config.dj.gameType,
            inparam
        }
        // 向N2同步
        let syncRes = await syncBill(bill)
        if (syncRes) {
            if (!syncRes.err) {
                ctx.body = { code: 1, errmsg: "", retobj: { transNo: syncRes.data.sn, credit: syncRes.balance.toString() } }
            }
        }
    } else {
        return next()
    }
})

// 免转接出-dj玩家退款
router.post('/dj/refund', async (ctx, next) => {
    const inparam = ctx.request.body
    const userId = inparam.account
    if (userId.length == 8) {
        // 预置数据
        const bill = {
            prefix: 'DJ',
            userId: +userId,
            method: 'refund',
            type: 5,
            amount: Math.abs(+inparam.refundAmount),
            betsn: inparam.orderNo,
            bk: inparam.orderNo,
            sn: inparam.orderNo,
            sourceIP: ipMap[userId],
            gameType: +config.dj.gameType,
            gameId: gameIdMap[userId] ? +gameIdMap[userId] : +config.dj.gameType,
            inparam
        }
        // 向N2同步
        let syncRes = await syncBill(bill)
        if (syncRes) {
            if (!syncRes.err) {
                ctx.body = { code: 1, errmsg: "", retobj: { transNo: syncRes.data.sn, credit: syncRes.balance.toString() } }
            }
        }
    } else {
        return next()
    }
})

/**
 * 玩家上线
 * @param {*} gameId NA游戏大类
 * @param {*} sid NA游戏ID
 * @param {*} userId NA玩家ID，0是试玩
 * @param {*} token NA玩家TOKEN，0是试玩
 * @param {*} lobbyType 0是电脑版，1是移动版 */
router.get('/dj/gameurl/:gameId/:sid/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    const inparam = ctx.params
    let source = ctx.request.query.lobbyType || '1'
    // 请求N1服务器是否允许玩家进入游戏
    const nares = await axios.post(config.na.joingameurl, { userId: inparam.userId, gameId: config.dj.gameType, sid: config.dj.gameId, token: inparam.token })
    if (nares.data.code != 0) {
        return ctx.body = { code: nares.data.code, msg: nares.data.msg }
    }
    // 检查玩家注册
    let player = await new PlayerModel().getPlayerById(inparam.userId)
    if (!player.regMap || !player.regMap.dj) {
        let res = await postDJ('create_user', { account: player.userId, userName: player.userId, pwd: '123456' })
        if (res.data.code == 1 || res.data.code == -4) {
            player.regMap ? player.regMap.dj = 1 : player.regMap = { dj: 1 }
            new PlayerModel().updateRegMap(player)
        } else {
            return ctx.body = res.data
        }
    }
    // 登录游戏
    let res = await postDJ('login', { account: player.userId, pwd: '123456', language: "0", source })
    ctx.redirect(res.data.retobj.url)
})

router.post('/dj/query_user_credit', async (ctx, next) => {
    const inparam = ctx.request.body
    const player = await new PlayerModel().getPlayerById(inparam.account)
    if (!player || _.isEmpty(player)) {
        ctx.body = { code: -2, errmsg: "玩家不存在" }
    } else {
        ctx.body = { code: 1, errmsg: "", retobj: { account: player.userId.toString(), credit: player.balance.toString() } }
    }
})

router.post('/dj/bet', async (ctx, next) => {
    const inparam = ctx.request.body
    const player = await new PlayerModel().getPlayerById(inparam.account)
    if (!player || _.isEmpty(player)) {
        return ctx.body = { code: -2, errmsg: "玩家不存在" }
    }
    // 计算玩家实时余额和更新
    inparam.gameType = config.dj.gameType
    inparam.amt = parseFloat(inparam.betAmount) * -1
    inparam.businessKey = `BDJ_${player.userId}_${inparam.orderNo}`
    inparam.txnidTemp = `${player.userId}_BET_${inparam.orderNo}`
    inparam.sourceIP = ipMap[player.userId]
    inparam.anotherGameData = JSON.stringify(inparam)
    const amtAfter = await new PlayerModel().updatebalance(player, inparam)
    if (amtAfter == 'err') {
        ctx.body = { code: -3, errmsg: "投注失败" }
    } else {
        ctx.body = { code: 1, errmsg: "", retobj: { transNo: inparam.sntemp, credit: amtAfter.toString() } }
    }
})

router.post('/dj/refund', async (ctx, next) => {
    const inparam = ctx.request.body
    const player = await new PlayerModel().getPlayerById(inparam.account)
    if (!player || _.isEmpty(player)) {
        return ctx.body = { code: -2, errmsg: "玩家不存在" }
    }
    // 计算玩家实时余额和更新
    inparam.gameType = config.dj.gameType
    inparam.billType = 5
    inparam.amt = parseFloat(inparam.refundAmount)
    inparam.businessKey = `BDJ_${player.userId}_${inparam.orderNo}`
    inparam.txnidTemp = `${player.userId}_REFUND_${inparam.orderNo}`
    inparam.betsn = `ADJ_${player.userId}_BET_${inparam.orderNo}`
    inparam.sourceIP = ipMap[player.userId]
    inparam.anotherGameData = JSON.stringify(inparam)
    const amtAfter = await new PlayerModel().updatebalance(player, inparam)
    ctx.body = { code: 1, errmsg: "", retobj: { transNo: inparam.sntemp, credit: amtAfter.toString() } }
    new PlayerModel().addRound(inparam)
})

router.post('/dj/prize', async (ctx, next) => {
    const inparam = ctx.request.body
    const player = await new PlayerModel().getPlayerById(inparam.account)
    if (!player || _.isEmpty(player)) {
        return ctx.body = { code: -2, errmsg: "玩家不存在" }
    }
    // 计算玩家实时余额和更新
    inparam.gameType = config.dj.gameType
    inparam.billType = 4
    inparam.amt = parseFloat(inparam.prizeAmount)
    inparam.businessKey = `BDJ_${player.userId}_${inparam.orderNo}`
    inparam.txnidTemp = `${player.userId}_WIN_${inparam.orderNo}`
    inparam.betsn = `ADJ_${player.userId}_BET_${inparam.orderNo}`
    inparam.sourceIP = ipMap[player.userId]
    inparam.anotherGameData = JSON.stringify(inparam)
    const amtAfter = await new PlayerModel().updatebalance(player, inparam)
    ctx.body = { code: 1, errmsg: "", retobj: { transNo: inparam.sntemp, credit: amtAfter.toString() } }
    new PlayerModel().addRound(inparam)
})

// 私有方法，请求DJ接口
function postDJ(method, inparam) {
    return axios.post(`${config.dj.server}/third/${method}`, inparam, {
        headers: {
            'X-MyHeader-api': config.dj.xmyheader,
            'X-code': config.dj.xcode,
            'X-signature': CryptoJS.MD5(`${config.dj.xcode}${JSON.stringify(inparam)}${config.dj.md5key}`).toString(CryptoJS.enc.Hex).toUpperCase()
        }
    })
}

function clearEmpty(obj) {
    for (let key in obj) {
        if (obj[key] == '') {
            delete obj[key]
        }
    }
    return obj
}

// 私有方法：等待
function waitASecond() {
    return new Promise((reslove, reject) => {
        setTimeout(function () {
            reslove('Y')
        }, 100000);
    })
}

module.exports = router