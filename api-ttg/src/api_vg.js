// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
var querystring = require("querystring")
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
    const inparam = ctx.params
    let res = {}
    // 默认移动版
    let gameversion = ctx.request.query.lobbyType != '0' ? 2 : 1
    // 正式玩家
    if (inparam.userId != 0) {
        // 请求N1服务器是否允许玩家进入游戏
        const nares = await axios.post(config.na.joingameurl, {
            userId: inparam.userId,
            gameId: config.vg.gameType,
            sid: config.vg.gameId,
            token: inparam.token
        })
        if (nares.data.code != 0) {
            return ctx.body = { code: nares.data.code, msg: nares.data.msg }
        }
        // 检查VG玩家注册
        let player = await new PlayerModel().getPlayerById(inparam.userId)
        if (!player.regMap || !player.regMap.vg) {
            res = await getVG({ username: inparam.userId, action: 'create' })
            if (res.response.errcode == '0' || res.response.errcode == '-99') {
                player.regMap ? player.regMap.vg = 1 : player.regMap = { vg: 1 }
                new PlayerModel().updateRegMap(player)
            } else {
                return ctx.body = res
            }
        }
        // 请求VG游戏登录
        res = await getVG({ username: inparam.userId, action: 'loginWithChannel', gametype: '1000', gameversion, create: 'true' })
    }
    // 试玩玩家
    else {
        res = await getVG({ gametype: '1000', gameversion })
    }
    ctx.redirect(res.response.result)
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
    let player = await new PlayerModel().getPlayerById(inparam.username)
    let balance = player.balance
    if (inparam.type == 'BET') {
        inparam.billType = 3
        inparam.amt = balance * -1
    } else {
        inparam.billType = 4
        balance = inparam.amt = Math.abs(inparam.amount)
    }
    inparam.gameType = config.vg.gameType
    inparam.businessKey = `BVG_${inparam.username}_${inparam.transactionId}`
    inparam.anotherGameData = JSON.stringify(inparam)
    inparam.txnidTemp = `${inparam.username}_${inparam.type}_${inparam.transactionId}`
    log.info(inparam)
    let amtAfter = await new PlayerModel().updatebalance(player, inparam)
    if (amtAfter == 'err') {
        ctx.body = { code: -1, msg: 'error' }
    } else {
        ctx.body = { code: 0, msg: 'success', balance }
    }
})

// 私有方法：VG请求
async function getVG(obj) {
    obj.channel = config.vg.channel
    let query = querystring.stringify(obj)
    let verifyCode = ''
    for (let key in obj) {
        verifyCode += obj[key]
    }
    verifyCode = CryptoJS.MD5(`${verifyCode}${config.vg.privatekey}`).toString(CryptoJS.enc.Hex).toUpperCase()
    let url = obj.action ? config.vg.apiUrl : config.vg.tryUrl
    let res = await axios.get(`${url}?${query}&verifyCode=${verifyCode}`)
    res = await xmlParse(res.data)
    return res
}

// 私有方法：XML解析
function xmlParse(xml) {
    return new Promise((reslove, reject) => {
        parseString(xml, { explicitArray: false }, (err, res) => {
            reslove(res)
        })
    })
}

module.exports = router