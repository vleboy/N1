// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const jwt = require('jsonwebtoken')
const _ = require('lodash')
const axios = require('axios')
const querystring = require('querystring')
const parseString = require('xml2js').parseString
const CryptoJS = require("crypto-js")
// 日志相关
const moment = require('moment')
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const ipMap = {}
/**
 * SA PC版本游戏链接
 * @param {*} userId   玩家ID
 * @param {*} token    玩家在NA的TOKEN
 * @param {*} lobbyType 0是电脑版1是移动版
 */
router.get('/sa/gameurl/:userId/:token', async (ctx, next) => {
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
    let lobbyType = ctx.request.query.lobbyType != '0' ? true : false
    // 登录请求（因为SA不支持下划线，所以使用用户ID）
    const data = saParams('LoginRequest', { Username: ctx.params.userId, CurrencyType: 'CNY' })
    // log.info(`请求SA【POST】${config.sa.apiurl}`)
    // log.info('请求SA【参数】' + querystring.stringify(data))
    const res = await axios.post(config.sa.apiurl, querystring.stringify(data), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    const finalRes = await xmlParse(res.data)
    // 进入大厅
    if (!finalRes || !finalRes.LoginRequestResponse) {
        ctx.body = { code: -1, msg: 'SA正在维护中...' }
    } else if (finalRes.LoginRequestResponse.ErrorMsgId == 0) {
        let page = '<body onload="document.mainform.submit();">'
        page += `<form name="mainform" action="${config.sa.appurl}" method="POST">`
        page += `<input type="hidden" id="username" name="username" value="${ctx.params.userId}">`
        page += `<input type="hidden" id="token" name="token" value="${finalRes.LoginRequestResponse.Token}">`
        page += `<input type="hidden" id="lobby" name="lobby" value="${config.sa.lobbyCode}">`
        page += `<input type="hidden" id="lang" name="lang" value="zh_CN">`
        page += `<input type="hidden" id="options" name="options" value="hideslot=1,hidemultiplayer=1">`
        if (lobbyType) {
            // page += `<input type="hidden" id="mobile" name="mobile" value="true">`
            // page += `<input type="hidden" id="returnurl" name="returnurl" value="uniwebview://www.baidu.com?key=value&anotherKey=anotherValue">`
            page += `<input type="hidden" id="mobilepremium" name="mobilepremium" value="true">`
            // page += `<input type="hidden" id="returnurl" name="returnurl" value="${config.na.apidomain}/sa/logout/${ctx.params.userId}/${config.sa.gameId}">`
        } else {
            // page += `<input type="hidden" id="h5web" name="h5web" value="true">`
        }
        page += `</form>`
        // log.info(page)
        ctx.body = page
    }
    else {
        ctx.body = finalRes.ErrorMsg
    }
})

/**
 * 获取SA捕鱼游戏链接
 * @param {*} token 玩家在NA的TOKEN
 */
router.get('/sa/fisher/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    // 解析NA的玩家TOKEN
    const decoded = jwt.decode(ctx.params.token)
    // 请求N1服务器是否允许玩家进入游戏
    const nares = await axios.post(config.na.joingameurl, {
        userId: decoded.userId,
        gameId: config.sa.fishGameType,
        sid: config.sa.fishGameId,
        token: ctx.params.token
    })
    if (nares.data.code != 0) {
        return ctx.body = { code: nares.data.code, msg: nares.data.msg }
    }
    // 登录请求（因为SA不支持下划线，所以使用用户ID）
    const data = saParams('LoginRequest', { Username: decoded.userId, CurrencyType: 'CNY', GameCode: 'Fishermen Gold', Language: 'zh_CN', Mobile: 1 })
    // log.info(`请求SA【POST】${config.sa.apiurl}`)
    // log.info('请求SA【参数】' + querystring.stringify(data))
    const res = await axios.post(config.sa.apiurl, querystring.stringify(data), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    const finalRes = await xmlParse(res.data)
    if (finalRes && finalRes.LoginRequestResponse && finalRes.LoginRequestResponse.GameURL && finalRes.LoginRequestResponse.GameURL[0]) {
        log.info(`SA【捕鱼链接】${finalRes.LoginRequestResponse.GameURL[0]}`)
        ctx.redirect(`${finalRes.LoginRequestResponse.GameURL[0]}`)//&returnurl=${config.na.apidomain}/sa/logout/${decoded.userId}/${config.sa.fishGameId}
    } else {
        ctx.body = { code: '-1', msg: '网络繁忙,请重试' }
        // ctx.redirect('https://uniwebview.na77.com?key=value&anotherKey=anotherValue')
    }
})

// /**
//  * 获取SA玩家TOKEN
//  * @param {*} userId 玩家ID
//  */
// router.get('/sa/token/:userId', async function (ctx, next) {
//     const data = saParams('LoginRequest', { Username: ctx.params.userId, CurrencyType: 'CNY' })
//     // log.info(`请求SA【POST】${config.sa.apiurl}`)
//     // log.info('请求SA【参数】' + querystring.stringify(data))
//     const res = await axios.post(config.sa.apiurl, querystring.stringify(data), {
//         headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
//     })
//     const finalRes = await xmlParse(res.data)
//     ctx.body = finalRes.LoginRequestResponse
// })

// /**
//  * 网页玩家登出
//  * @param {*} userId 玩家ID
//  * @param {*} sid 具体游戏ID
//  */
// router.get('/sa/logout/:userId/:sid', async (ctx, next) => {
//     // log.info(`准备退出玩家【${ctx.params.userId}】`)
//     // 请求N1退出
//     let data = {
//         exit: 1,
//         userId: ctx.params.userId,
//         gameType: config.sa.gameType,
//         gameId: ctx.params.sid,
//         timestamp: Date.now()
//     }
//     // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.sa.gameKey}`).toString(CryptoJS.enc.Hex)
//     axios.post(config.na.exiturl, data).then(res => {
//         res.data.code != 0 ? log.error(res.data) : null
//     }).catch(err => {
//         log.error(err)
//     })
//     // ctx.body = { code: 0, msg: '退出成功' }
//     if (ctx.request.query.homeurl) {
//         ctx.redirect(decodeURIComponent(ctx.request.query.homeurl))
//     } else {
//         ctx.redirect('http://uniwebview.na77.com?key=value&anotherKey=anotherValue')
//     }
// })

// xml解析
function xmlParse(xml) {
    return new Promise((reslove, reject) => {
        parseString(xml, function (err, res) {
            reslove(res)
        })
    })
}

// SA参数组装
function saParams(method, inparam) {
    const time = moment().format('YYYYMMDDHHmmss')
    let qs = `method=${method}&Key=${config.sa.secretkey}&Time=${time}&`
    for (let key in inparam) {
        qs += (`${key}=${inparam[key]}&`)
    }
    qs = qs.substring(0, qs.length - 1)
    const qsencrypt = saEnctypt(qs, config.sa.encryptKey)
    const md5 = CryptoJS.MD5(`${qs}${config.sa.md5key}${time}${config.sa.secretkey}`).toString(CryptoJS.enc.Hex)
    return { q: qsencrypt, s: md5 }
}
// SA加密
function saEnctypt(data, secretkey) {
    const key = CryptoJS.enc.Utf8.parse(secretkey)
    const iv = CryptoJS.enc.Utf8.parse(secretkey)
    var encrypted = CryptoJS.DES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    })
    return encrypted.toString()
}
// SA解密
function saDecrypt(encrypted, secretkey) {
    const key = CryptoJS.enc.Utf8.parse(secretkey)
    const iv = CryptoJS.enc.Utf8.parse(secretkey)
    var decrypted = CryptoJS.DES.decrypt(encrypted, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    })
    return CryptoJS.enc.Utf8.stringify(decrypted)// 转换为 utf8 字符串
}

// 私有方法：等待
function waitASecond() {
    return new Promise((reslove, reject) => {
        setTimeout(function () {
            reslove('Y')
        }, 500);
    })
}

module.exports = router