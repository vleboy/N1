// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
// const CryptoJS = require('crypto-js')
const querystring = require('querystring')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const ipMap = {}
/**
 * HABA PC版本游戏链接
 * gameName 游戏名称
 * gameId 游戏大类
 * sid    游戏小类
 * userId 玩家ID
 * token  玩家的NA令牌
 */
router.get('/maya/gameurl/:gameName/:gameId/:sid/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    let inparam = ctx.params
    let finalUrl = ''
    // 试玩 &clientType=1 可以增加返回按钮
    if (inparam.userId == 0) {
        finalUrl = `${config.dt.launchUrl}?&language=zh_CN&gameCode=${inparam.gameName}&isfun=1`//&closeUrl=http://uniwebview.na77.com
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
            // 'CLOSEURL': `https://${config.na.apidomain}/dt/logout/${inparam.userId}/${inparam.sid}`
        }
        log.info(`登录DT请求链接：${config.dt.dturl}?${querystring.stringify(dtData)}`)
        const infoRes = await axios.get(`${config.dt.dturl}?${querystring.stringify(dtData)}`)
        log.info(`登录DT请求返回：${JSON.stringify(infoRes.data)}`)
        finalUrl = `${infoRes.data.data}`
    }
    log.info(`DT最终游戏链接：${finalUrl}`)
    ctx.redirect(finalUrl)
})

// 登录认证
router.get('/maya/CheckLogin', async function (ctx, next) {
    let inparam = ctx.params
    player = await new PlayerModel().getPlayerById(inparam.MemberName)
})

// 会员限红
router.get('/maya/GetMemberLimitInfo', async function (ctx, next) {

})

// 会员余额
router.get('/maya/GetMainBalance', async function (ctx, next) {

})

// 流水交易
router.get('/maya/GameFundTransfer', async function (ctx, next) {

})

// /**
//  * 玩家登出
//  * @param {*} userId 玩家ID
//  * @param {*} sid    具体游戏ID
//  */
// router.get('/maya/logout/:userId/:sid', async (ctx, next) => {
//     // log.info(`准备退出玩家【${userId}】`)
//     // 请求N1退出
//     let data = {
//         exit: 1,
//         userId: ctx.params.userId,
//         gameType: config.maya.gameType,
//         gameId: ctx.params.sid,
//         timestamp: Date.now()
//     }
//     // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.maya.gameKey}`).toString(CryptoJS.enc.Hex)
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

// function mayaDecrypt(inparam) {
//     let NowDateTime = inparam.NowDateTime
//     let MD5DATA = inparam.MD5DATA
// }
module.exports = router