// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const CryptoJS = require("crypto-js")
const parseString = require('xml2js').parseString
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const ipMap = {}

/**
 * VG 游戏链接
 * gameId 游戏大类
 * sid    游戏小类
 * userId 玩家ID
 * token  玩家的NA令牌
 * lobbyType 0是电脑版1是移动版
 */
router.get('/vg/gameurl/:gameId/:sid/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    // 请求N1服务器是否允许玩家进入游戏
    const nares = await axios.post(config.na.joingameurl, {
        userId: ctx.params.userId,
        gameId: config.sa.gameType,
        sid: config.sa.gameId,
        token: ctx.params.token
    })
    if (nares.data.code != 0) {
        return ctx.body = { code: nares.data.code, msg: nares.data.msg }
    }
    // 默认移动版
    let gameversion = ctx.request.query.lobbyType != '0' ? 2 : 1
    // 请求VG游戏登录
    let verifyCode = CryptoJS.MD5(`${ctx.params.userId}loginWithChannel${config.vg.channel}1000${gameversion}true${config.vg.privatekey}`).toString(CryptoJS.enc.Hex)
    let finalUrl = await axios.get(`http://<server>/webapi/interface.aspx?username=${ctx.params.userId}&action=loginWithChannel&channel=${config.vg.channel}&gametype=1000&gameversion=${gameversion}&create=true&verifyCode=${verifyCode}`)
    // 跳转VG游戏
    log.info(`VG游戏链接 ${finalUrl}`)
    ctx.redirect(finalUrl)
})

/**
 * VG 游戏链接
 * userId 玩家ID
 * type   上分或下分
 * id     流水ID
 * betId  关联交易号
 */
router.post('/vg/transaction', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    let inparam = ctx.request.body
    console.log(inparam)
    
    let player = await new PlayerModel().getPlayerById(inparam.userId)
    if (inparam.type == 'BET') {
        inparam.billType = 3
        inparam.amount = player.balance * -1
    } else {
        inparam.billType = 4
        inparam.amount = Math.abs(inparam.amount)
    }
    inparam.gameType = config.vg.gameType
    inparam.businessKey = `BVG_${inparam.username}_${inparam.transactionId}`
    inparam.anotherGameData = JSON.stringify(inparam)
    inparam.txnidTemp = `${inparam.username}_${inparam.type}_${inparam.transactionId}`

    // let amtAfter = await new PlayerModel().updatebalance(player, inparam)

    // if (amtAfter == 'err') {
    //     ctx.body = { code: -1, msg: 'error' }
    // } else {
    //     ctx.body = { code: 0, msg: 'success', balance: amtAfter }
    // }
})

module.exports = router