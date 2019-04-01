// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
// const crypto = require('crypto')
// const CryptoJS = require('crypto-js')
// const querystring = require('querystring')
// const jwt = require('jsonwebtoken')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')

/**
 * PNG PC版本游戏链接
 * gameName 游戏名称
 * gameId 游戏大类
 * sid    游戏小类
 * userId 玩家ID
 * token  玩家的NA令牌
 */
router.get('/png/gameurl/:gameName/:gameId/:sid/:userId/:token', async function (ctx, next) {
    let inparam = ctx.params
    let finalUrl = ''
    // 试玩
    if (inparam.userId == 0) {
        finalUrl = `${config.png.launchUrl}?pid=${config.png.pid}&gid=${inparam.gameName}&brand=${config.png.brandId}&lang=zh_CN&practice=1`
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
        // const data = {
        //     userId: inparam.userId,
        //     exp: Math.floor((Date.now() + 15 * 60 * 1000) / 1000)
        // }
        // let ticket = jwt.sign(data, config.png.gameKey)
        let ticket = `${Date.now()}${inparam.userId}`
        finalUrl = `${config.png.launchUrl}?pid=${config.png.pid}&gid=${inparam.gameName}&brand=${config.png.brandId}&lang=zh_CN&ticket=${ticket}`
    }
    log.info(`PNG最终游戏链接：${finalUrl}`)
    ctx.redirect(finalUrl)
})

// 登录认证
router.post('/png/Authenticate', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body.authenticate
    //会话口令验证，一次有效15分钟之内
    try {
        //let verifyToken = jwt.verify(inparam.username[0], config.png.gameKey)
        let ticket = inparam.username[0].substring(13)
        //查询玩家
        let playerInfo = await new PlayerModel().getPlayerById(ticket)
        //返回需要的数据
        ctx.body = `<authenticate>
                <externalId>${config.png.brandId}${playerInfo.userId}</externalId>
                <statusCode>0</statusCode>
                <statusMessage>ok</statusMessage>
                <userCurrency>CNY</userCurrency>
                <country>CN</country>
                <birthdate>1970-01-01</birthdate>
                <registration>2010-05-05</registration>
                <language>zh_CN</language>
                <real>${playerInfo.balance.toString()}</real>
            </authenticate>`
    } catch (err) {
        //验证失败
        ctx.body = `<authenticate>
                <statusCode>10</statusCode>
                <statusMessage>玩家会话已过期</statusMessage>
            </authenticate>`
    }
})

// 余额
router.post('/png/Balance', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body.balance
    //验证玩家
    const player = await new PlayerModel().getPlayerById(inparam.externalId[0].substring(3))
    //返回结果
    ctx.body = `<balance>
                <real>${player.balance.toString()}</real>
                <currency>CNY</currency>   
                <statusCode>0</statusCode> 
           </balance>`
})

// 下注
router.post('/png/Reserve', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body.reserve
    for (let key in inparam) {
        if (!inparam[key] || inparam[key][0].length == 0) {
            delete inparam[key]
        }
    }
    //验证玩家
    const player = await new PlayerModel().getPlayerById(inparam.externalId[0].substring(3))
    if (inparam.roundId[0] == '0') {
        return ctx.body = `<reserve>
                            <real>${player.balance.toString()}</real>
                            <currency>CNY</currency>
                            <statusCode>0</statusCode>
                        </reserve>`
    }
    //构造下注参数
    inparam.billType = 3
    inparam.amt = Math.abs(inparam.real[0]) * -1
    inparam.gameType = config.png.gameType
    inparam.businessKey = `BPNG_${player.userId}_${inparam.roundId[0]}`                      // 设置bk
    inparam.txnidTemp = `BET_${player.userId}_${inparam.transactionId[0]}`                   // 设置sn
    inparam.anotherGameData = JSON.stringify(inparam)                                        // 原始游戏信息
    const amtAfter = await new PlayerModel().updatebalance(player, inparam)
    if (amtAfter == 'err') {
        ctx.body = `<reserve>
                <statusCode>7</statusCode>
                <statusMessage>余额不足</statusMessage>
                <real>${player.balance.toString()}</real>
                <currency>CNY</currency>
             </reserve>`
    } else {
        ctx.body = `<reserve>
                <real>${amtAfter.toString()}</real>
                <currency>CNY</currency>
                <statusCode>0</statusCode>
            </reserve>`
    }
})

// 返奖
router.post('/png/Release', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body.release
    for (let key in inparam) {
        if (!inparam[key] || inparam[key][0].length == 0) {
            delete inparam[key]
        }
    }
    //验证玩家
    const player = await new PlayerModel().getPlayerById(inparam.externalId[0].substring(3))
    if (inparam.roundId[0] == '0') {
        return ctx.body = `<release>
                            <real>${player.balance.toString()}</real>
                            <currency>CNY</currency>
                            <statusCode>0</statusCode>
                        </release>`
    }
    //构造下注参数
    inparam.billType = 4
    inparam.amt = Math.abs(inparam.real[0])
    inparam.gameType = config.png.gameType
    inparam.businessKey = `BPNG_${player.userId}_${inparam.roundId[0]}`                      // 设置bk
    inparam.txnidTemp = `WIN_${player.userId}_${inparam.transactionId[0]}`                   // 设置sn
    inparam.anotherGameData = JSON.stringify(inparam)                                        // 原始游戏信息
    const amtAfter = await new PlayerModel().updatebalance(player, inparam)
    if (amtAfter == 'err') {
        ctx.body = `<release>
                <statusCode>7</statusCode>
                <statusMessage>余额不足</statusMessage>
                <real>${player.balance.toString()}</real>
                <currency>CNY</currency>
            </release>`
    } else {
        ctx.body = `<release>
              <real>${amtAfter.toString()}</real>
              <currency>CNY</currency>
              <statusCode>0</statusCode>
            </release>`
    }
})

// 退款
router.post('/png/CancelReserve', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body.cancelReserve
    for (let key in inparam) {
        if (!inparam[key] || inparam[key][0].length == 0) {
            delete inparam[key]
        }
    }
    //验证玩家
    const player = await new PlayerModel().getPlayerById(inparam.externalId[0].substring(3))
    //构造下注参数
    inparam.billType = 5
    inparam.amt = Math.abs(inparam.real[0])
    inparam.gameType = config.png.gameType
    inparam.businessKey = `BPNG_${player.userId}_${inparam.roundId[0]}`                      // 设置bk
    inparam.txnidTemp = `REFUND_${player.userId}_${inparam.transactionId[0]}`                // 设置sn
    inparam.anotherGameData = JSON.stringify(inparam)                                        // 原始游戏信息
    await new PlayerModel().updatebalance(player, inparam)
    ctx.body = `<cancelReserve>
                <statusCode>0</statusCode>
                <transactionId>${inparam.transactionId[0]}</transactionId>
            </cancelReserve>`
})

/**
 * 玩家登出
 * @param {*} userId 玩家ID
 * @param {*} sid    具体游戏ID
 */
router.get('/png/logout/:userId/:sid', async function (ctx, next) {
    // log.info(`准备退出玩家【${userId}】`)
    if (ctx.params.userId == 0) {
        return ctx.redirect(decodeURIComponent(ctx.request.query.homeurl))
    }
    // 请求N1退出
    let data = {
        exit: 1,
        userId: ctx.params.userId,
        gameType: config.png.gameType,
        gameId: ctx.params.sid,
        timestamp: Date.now()
    }
    // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.png.gameKey}`).toString(CryptoJS.enc.Hex)
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

// //DES加密
// function aesEncode(data, key) {
//     var cipherChunks = [];
//     var cipher = crypto.createCipheriv('aes-128-ecb', key.substring(0, 16), '');
//     cipher.setAutoPadding(true);
//     cipherChunks.push(cipher.update(data, 'utf8', 'base64'));
//     cipherChunks.push(cipher.final('base64'));
//     return cipherChunks.join('');
// }
// //AES解密
// function aesDecode(data, key) {
//     var cipherChunks = [];
//     var decipher = crypto.createDecipheriv('aes-128-ecb', key.substring(0, 16), '');
//     decipher.setAutoPadding(true);
//     cipherChunks.push(decipher.update(data, 'base64', 'utf8'));
//     cipherChunks.push(decipher.final('utf8'));
//     return cipherChunks.join('');
// }

module.exports = router