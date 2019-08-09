// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const CryptoJS = require("crypto-js")
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
router.get('/dj/gameurl/:gameId/:sid/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    const inparam = ctx.params
    // 请求N1服务器是否允许玩家进入游戏
    const nares = await axios.post(config.na.joingameurl, { userId: inparam.userId, gameId: config.vg.gameType, sid: config.vg.gameId, token: inparam.token })
    if (nares.data.code != 0) {
        return ctx.body = { code: nares.data.code, msg: nares.data.msg }
    }
    // 检查玩家注册
    let player = await new PlayerModel().getPlayerById(inparam.userId)
    if (!player.regMap || !player.regMap.yibo) {
        res = await postYIBO('create_user', { account: player.userId, userName: player.userId, pwd: '123456' })
        if (res.data.code == 1 || res.data.code == -4) {
            player.regMap ? player.regMap.yibo = 1 : player.regMap = { yibo: 1 }
            new PlayerModel().updateRegMap(player)
        } else {
            return ctx.body = res.data
        }
    }
})

router.post('/dj/query_user_credit', async (ctx, next) => {
    const inparam = ctx.request.body
    const player = await new PlayerModel().getPlayerById(inparam.account)
    if (!player || _.isEmpty(player)) {
        ctx.body = { code: -2, errmsg: "玩家不存在" }
    } else {
        ctx.body = { code: 1, errmsg: "", retobj: { account: player.userId, credit: player.balance } }
    }
})

router.post('/dj/bet', async (ctx, next) => {
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
        ctx.body = { code: 1, errmsg: "", retobj: { transNo: inparam.sntemp, credit: amtAfter } }
    }
})

router.post('/dj/refund', async (ctx, next) => {
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
    ctx.body = { code: 1, errmsg: "", retobj: { transNo: inparam.sn, credit: amtAfter } }
})

router.post('/dj/prize', async (ctx, next) => {
    const player = await new PlayerModel().getPlayerById(inparam.account)
    if (!player || _.isEmpty(player)) {
        return ctx.body = { code: -2, errmsg: "玩家不存在" }
    }
    // 计算玩家实时余额和更新
    inparam.gameType = config.dj.gameType
    inparam.amt = parseFloat(inparam.prizeAmount)
    inparam.businessKey = `BDJ_${player.userId}_${inparam.orderNo}`
    inparam.txnidTemp = `${player.userId}_WIN_${inparam.orderNo}`
    inparam.betsn = `ADJ_${player.userId}_BET_${inparam.orderNo}`
    inparam.sourceIP = ipMap[player.userId]
    inparam.anotherGameData = JSON.stringify(inparam)
    const amtAfter = await new PlayerModel().updatebalance(player, inparam)
    ctx.body = { code: 1, errmsg: "", retobj: { transNo: inparam.sn, credit: amtAfter } }
})

// 私有方法，请求YIBO接口
function postYIBO(method, inparam) {
    return axios.post(`${config.yibo.server}/third/${method}`, inparam, {
        headers: {
            'X-MyHeader-api': config.yibo.xmyheader,
            'X-code': config.yibo.xcode,
            'X-signature': CryptoJS.MD5(`${config.yibo.xcode}${JSON.stringify(inparam)}${config.vg.md5key}`).toString(CryptoJS.enc.Hex).toUpperCase()
        }
    })
}

module.exports = router