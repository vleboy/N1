// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const moment = require('moment')
var querystring = require("querystring")
const CryptoJS = require("crypto-js")
const parseString = require('xml2js').parseString
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const SYSTransferModel = require('./model/SYSTransferModel')
const ipMap = {}
const gameIdMap = {}
// 免转接出-VG游戏链接
router.get('/vg/:gameId/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    gameIdMap[ctx.params.userId] = ctx.params.gameId
    const inparam = ctx.params
    let res = {}
    // 请求N2服务器是否允许玩家进入游戏
    const n2res = await axios.post(config.n2.apiUrl, { userId: inparam.userId, method: 'auth' })
    if (n2res.data.code != 0) {
        return ctx.body = { code: n2res.data.code, msg: n2res.data.msg }
    }
    // 检查VG玩家注册
    const player = {
        userId: inparam.userId,
        regMap: n2res.data.regMap,
        balance: n2res.data.balance
    }
    if (!player.regMap || !player.regMap.vg) {
        res = await getVG({ username: inparam.userId, action: 'create' })
        if (res.response.errcode == '0' || res.response.errcode == '-99') {
            player.regMap ? player.regMap.vg = 1 : player.regMap = { vg: 1 }
            player.method = 'update'
            axios.post(config.n2.apiUrl, player)
        } else {
            return ctx.body = res
        }
    }
    // 请求VG游戏登录
    res = await getVG({ username: inparam.userId, action: 'loginWithChannel', gametype: '1000', gameversion: 2, create: 'true' })
    ctx.redirect(res.response.result)
})

//免转接出-VG数据传输
router.post('/vg/transaction', async (ctx, next) => {
    let inparam = ctx.request.body
    if (inparam.username.length == 8) {
        // 预置请求数据
        const data = {
            userId: +inparam.username,
            method: '',
            amount: 0,
            betsn: null,
            businessKey: `BVG_${inparam.username}_${inparam.transactionId}`,
            sn: `VG_${inparam.username}_${inparam.type}_${inparam.transactionId}`,
            timestamp: Date.now(),
            sourceIP: ipMap[inparam.username],
            gameType: +config.vg.gameType,
            gameId: gameIdMap[inparam.username] ? +gameIdMap[inparam.username] : +config.vg.gameType,
            detail: clearEmpty(inparam)
        }
        // 预置SYSTransfer数据
        let item = {
            ..._.omit(data, ['method', 'timestamp', 'detail']),
            plat: 'YIBO',
            userId: data.userId.toString(),
            userNick: data.userId.toString(),
            anotherGameData: JSON.stringify(inparam),
            createdAt: data.timestamp,
            createdDate: moment(data.timestamp).utcOffset(8).format('YYYY-MM-DD'),
            createdStr: moment(data.timestamp).utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
        }
        const n2res = await axios.post(config.n2.apiUrl, { userId: data.userId, method: 'balance' })
        const balance = n2res.data.balance
        // if (n2res.data.code != 0) {
        //     return ctx.body = { code: n2res.data.code, msg: n2res.data.msg }
        // }
        if (inparam.type == 'BALANCE') {
            return ctx.body = { code: 0, balance }
        } else if (inparam.type == 'BET') {
            item.type = 3
            data.method = 'bet'
            data.amount = balance * -1
        } else {
            item.type = 4
            data.method = 'win'
            data.amount = Math.abs(inparam.amount)
        }
        // 向N2同步
        try {
            let n2res = await axios.post(config.n2.apiUrl, data)
            if (n2res.data.code == 0) {
                item.status = 'Y'
                item.balance = n2res.data.balance ? +n2res.data.balance : 0
                new SYSTransferModel().putItem(item)
                ctx.body = { code: 0, msg: 'success', balance }
            } else {
                if (n2res.data.code == -1) {
                    item.status = 'N'
                    item.errorMsg = n2res.data.msg
                    item.transferURL = config.n2.apiUrl
                    item.repush = data
                    new SYSTransferModel().putItem(item)
                } else {
                    ctx.body = { code: -1, msg: 'error' }
                }
            }
        } catch (error) {
            item.status = 'E'
            item.transferURL = config.n2.apiUrl
            item.repush = data
            new SYSTransferModel().putItem(item)
        }
    } else {
        return next()
    }
})

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
        const nares = await axios.post(config.na.joingameurl, { userId: inparam.userId, gameId: config.vg.gameType, sid: config.vg.gameId, token: inparam.token })
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
 * VG 免转接口
 * username         玩家ID
 * type             BALANCE/BET/RET
 * transactionId    交易号
 * amount           返还金额
 */
router.post('/vg/transaction', async (ctx, next) => {
    let inparam = ctx.request.body
    let player = await new PlayerModel().getPlayerById(inparam.username)
    let balance = player.balance
    if (inparam.type == 'BALANCE') {
        return ctx.body = { code: 0, balance: player.balance }
    } else if (inparam.type == 'BET') {
        inparam.billType = 3
        inparam.amt = balance * -1
    } else {
        inparam.billType = 4
        balance = inparam.amt = Math.abs(inparam.amount)
    }
    inparam.gameType = config.vg.gameType
    inparam.businessKey = `BVG_${player.userId}_${inparam.transactionId}`
    inparam.txnidTemp = `${player.userId}_${inparam.type}_${inparam.transactionId}`
    inparam.sourceIP = ipMap[player.userId]
    let amtAfter = await new PlayerModel().updatebalance(player, inparam)
    if (amtAfter == 'err') {
        ctx.body = { code: -1, msg: 'error' }
    } else {
        if (inparam.billType == 4) {
            new PlayerModel().addRound(inparam)
        }
        ctx.body = { code: 0, msg: 'success', balance }
    }
})

/**
 * VG 查询游戏记录
 */
router.get('/vg/betdetail/:id', async (ctx, next) => {
    let res = await getVG({ id: ctx.params.id })
    ctx.body = res.data.value
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
    if (!obj.id) {
        let res = await axios.get(`${url}?${query}&verifyCode=${verifyCode}`)
        return xmlParse(res.data)
    } else {
        return axios.get(`${config.vg.recordUrl}?${query}&verifyCode=${verifyCode}`)
    }
}

// 私有方法：XML解析
function xmlParse(xml) {
    return new Promise((reslove, reject) => {
        parseString(xml, { explicitArray: false }, (err, res) => {
            reslove(res)
        })
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