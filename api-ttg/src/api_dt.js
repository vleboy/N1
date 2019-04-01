// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const CryptoJS = require('crypto-js')
const querystring = require('querystring')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
// const NASign = require('./lib/NASign')

/**
 * DT PC版本游戏链接
 * gameName 游戏名称
 * gameId 游戏大类
 * sid    游戏小类
 * userId 玩家ID
 * token  玩家的NA令牌
 */
router.get('/dt/gameurl/:gameName/:gameId/:sid/:userId/:token', async function (ctx, next) {
    let inparam = ctx.params
    let finalUrl = ''
    // 试玩 &clientType=1 可以增加返回按钮
    if (inparam.userId == 0) {
        finalUrl = `${config.dt.launchUrl}?&language=zh_CN&gameCode=${inparam.gameName}&isfun=1&closeUrl=http://uniwebview.na77.com`
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
            ctx.body = { code: nares.data.code, msg: nares.data.msg }
            return
        }
        const dtData = {
            'METHOD': 'LOGIN',
            'BUSINESS': config.dt.merchantCode,
            'GAMECODE': inparam.gameName,
            'LANGUAGE': 'zh_CN',
            'TOKEN': inparam.userId,
            'REMARK': 'REMARK',
            'CLOSEURL': `https://${config.na.apidomain}/dt/logout/${inparam.userId}/${inparam.sid}`
        }
        log.info(`登录DT请求链接：${config.dt.dturl}?${querystring.stringify(dtData)}`)
        const infoRes = await axios.get(`${config.dt.dturl}?${querystring.stringify(dtData)}`)
        log.info(`登录DT请求返回：${JSON.stringify(infoRes.data)}`)
        finalUrl = `${infoRes.data.data}`
    }
    log.info(`DT最终游戏链接：${finalUrl}`)
    ctx.redirect(finalUrl)
})

/**
 * DT唯一接口
 * @param {*} token 玩家TOKEN
 */
router.post('/dt/postTransfer', async function (ctx, next) {
    let inparam = ctx.request.body
    let betInparam = {}
    let retInparam = {}
    let betPlayer = {}
    let retPlayer = {}
    let player = {}
    let MSG = '', data = {}, CODE = ''
    let amtAfter = 0
    switch (inparam.method) {
        case 'oauth':
            log.info('DT请求oauth接口，参数是' + JSON.stringify(inparam))
            if (!inparam.token && inparam.token != 0) {
                MSG = '玩家认证令牌丢失'
                CODE = '0003'
            } else {
                player = await new PlayerModel().getPlayerById(inparam.token)
                if (!player) {
                    MSG = '玩家不存在,认证失败'
                    CODE = '4004'
                } else {
                    MSG = '成功'
                    CODE = '0000'
                    data.playerPrice = player.balance.toString()
                    data.playerName = player.userId.toString()
                    data.currency = 'CNY'
                    data.lb = 'L0'
                    data.nickName = player.userId.toString()
                }
            }
            break;
        case 'checkBalance':
            if (!inparam.token) {
                MSG = '获取余额认证令牌丢失'
                CODE = '0003'
            } else {
                player = await new PlayerModel().getPlayerById(inparam.token)
                if (!player) {
                    MSG = '玩家不存在,获取余额错误'
                    CODE = '4004'
                } else {
                    MSG = '成功'
                    CODE = '0000'
                    data.playerPrice = player.balance.toString()
                    data.playerName = inparam.playerName
                    data.currency = 'CNY'
                    data.lb = 'L0'
                }
            }
            break;
        case 'bet':
            //模拟下注
            betPlayer = await new PlayerModel().getPlayerById(inparam.playerName)
            betInparam.billType = 3
            betInparam.amt = parseFloat(inparam.betPrice) * -1
            betInparam.gameType = config.dt.gameType
            betInparam.businessKey = `BDT_${betPlayer.userId}_${inparam.betId}`                        // 设置局号
            betInparam.txnid = inparam.betId                                                           // 第三方游戏流水号
            betInparam.txnidTemp = `${betPlayer.userId}_BET_${inparam.betId}`
            betInparam.anotherGameData = JSON.stringify(inparam)
            amtAfter = await new PlayerModel().updatebalance(betPlayer, betInparam)
            if (amtAfter == 'err') {
                MSG = '失败，余额不足'
                CODE = '0001'
            } else if (amtAfter == betPlayer.balance && betInparam.amt != 0) {
                MSG = '失败，重复账单'
                CODE = '4004'
            } else {
                //模拟返奖
                retInparam = {}
                retPlayer = await new PlayerModel().getPlayerById(inparam.playerName)
                retInparam.billType = 4
                retInparam.amt = parseFloat(inparam.betWins)
                retInparam.gameType = config.dt.gameType
                retInparam.businessKey = `BDT_${retPlayer.userId}_${inparam.betId}`                    // 设置局号
                retInparam.txnid = inparam.betId                                                       // 第三方游戏流水号
                retInparam.txnidTemp = `${retPlayer.userId}_WIN_${inparam.betId}`
                retInparam.anotherGameData = JSON.stringify(inparam)
                amtAfter = await new PlayerModel().updatebalance(retPlayer, retInparam)
                MSG = 'SUCCESS'
                CODE = '0000'
                data.method = 'bet'
                data.playerPrice = amtAfter.toString()
                data.sign = CryptoJS.MD5(inparam.betId + inparam.method + inparam.playerName + amtAfter.toString() + config.dt.apiKey).toString()
                data.playerName = inparam.playerName
                data.id = inparam.betId
            }
            break;
        case 'errorBet':
            betPlayer = await new PlayerModel().getPlayerById(inparam.playerName)
            betInparam.billType = 3
            betInparam.amt = parseFloat(inparam.betPrice) * -1
            betInparam.gameType = config.dt.gameType
            betInparam.businessKey = `BDT_${betPlayer.userId}_${inparam.id}`                        // 设置局号
            betInparam.txnid = inparam.id                                                           // 第三方游戏流水号
            betInparam.txnidTemp = `${betPlayer.userId}_BET_${inparam.id}`
            betInparam.anotherGameData = JSON.stringify(inparam)
            amtAfter = await new PlayerModel().updatebalance(betPlayer, betInparam)
            if (amtAfter == 'err') {
                MSG = '失败，余额不足'
                CODE = '0001'
                data.processStatus = 2
            } else if (amtAfter == betPlayer.balance && betInparam.amt != 0) {
                MSG = '失败，重复账单'
                CODE = '4004'
                data.processStatus = 2
            } else {
                //模拟返奖
                retInparam = {}
                retPlayer = await new PlayerModel().getPlayerById(inparam.playerName)
                retInparam.billType = 4
                retInparam.amt = parseFloat(inparam.betWins)
                retInparam.gameType = config.dt.gameType
                retInparam.businessKey = `BDT_${retPlayer.userId}_${inparam.id}`                    // 设置局号
                retInparam.txnid = inparam.id                                                       // 第三方游戏流水号
                retInparam.txnidTemp = `${retPlayer.userId}_WIN_${inparam.id}`
                retInparam.anotherGameData = JSON.stringify(inparam)
                amtAfter = await new PlayerModel().updatebalance(retPlayer, retInparam)
                MSG = 'SUCCESS'
                CODE = '0000'
                data.processStatus = 0
            }
            break;
    }
    log.info(`返回DT的数据是：${JSON.stringify({ MSG, data, CODE })}`)
    ctx.body = { MSG, data, CODE }
})

// /**
//  * DT返奖重推
//  * @param {*} token 玩家TOKEN
//  */
// router.post('/dt/ret', async function (ctx, next) {
//     let inparam = ctx.request.body
//     // let betInparam = {}
//     let retInparam = {}
//     // let betPlayer = {}
//     let retPlayer = {}
//     // let player = {}
//     let MSG = '', data = {}, CODE = ''
//     let amtAfter = 0

//     //模拟返奖
//     retInparam = {}
//     retPlayer = await new PlayerModel().getPlayerById(inparam.playerName)
//     retInparam.billType = 4
//     retInparam.amt = parseFloat(inparam.betWins)
//     retInparam.gameType = config.dt.gameType
//     retInparam.businessKey = `BDT_${retPlayer.userId}_${inparam.betId}`                    // 设置局号
//     retInparam.txnid = inparam.betId                                                       // 第三方游戏流水号
//     retInparam.txnidTemp = `${retPlayer.userId}_WIN_${inparam.betId}`
//     retInparam.anotherGameData = JSON.stringify(inparam)
//     amtAfter = await new PlayerModel().updatebalance(retPlayer, retInparam)
//     MSG = 'SUCCESS'
//     CODE = '0000'
//     data.method = 'bet'
//     data.playerPrice = amtAfter.toString()
//     data.sign = CryptoJS.MD5(inparam.betId + inparam.method + inparam.playerName + amtAfter.toString() + config.dt.apiKey).toString()
//     data.playerName = inparam.playerName
//     data.id = inparam.betId

//     log.info(`返回DT的数据是：${JSON.stringify({ MSG, data, CODE })}`)
//     ctx.body = { MSG, data, CODE }
// })

/**
 * 玩家登出
 * @param {*} userId 玩家ID
 * @param {*} sid    具体游戏ID
 */
router.get('/dt/logout/:userId/:sid', async function (ctx, next) {
    // log.info(`准备退出玩家【${userId}】`)
    if (ctx.params.userId == 0) {
        return ctx.redirect(decodeURIComponent(ctx.request.query.homeurl))
    }
    // 请求N1退出
    let data = {
        exit: 1,
        userId: ctx.params.userId,
        gameType: config.dt.gameType,
        gameId: ctx.params.sid,
        timestamp: Date.now()
    }
    // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.dt.gameKey}`).toString(CryptoJS.enc.Hex)
    axios.post(config.na.exiturl, data).then(res => {
        res.data.code != 0 ? log.error(res.data) : null
    }).catch(err => {
        log.error(err)
    })
    // ctx.body = { code: 0, msg: '退出成功' }
    if (ctx.request.query.homeurl) {
        ctx.redirect(decodeURIComponent(ctx.request.query.homeurl))
    } else {
        ctx.redirect('http://uniwebview.na77.com?key=value&anotherKey=anotherValue')
    }
})
module.exports = router