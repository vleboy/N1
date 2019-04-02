// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const jwt = require('jsonwebtoken')
const _ = require('lodash')
const axios = require('axios')
const CryptoJS = require('crypto-js')
const querystring = require('querystring')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')

/**
 * 进入游戏大厅
 * lobbyType 0是电脑版1是移动版
 */
router.get('/sb/gameurl/:gameName/:gameId/:sid/:userId/:token', async function (ctx, next) {
    let inparam = ctx.params
    let gpcode = inparam.gameId == config.sb.gameType ? 'TGP' : 'SB'
    let launchUrl = config.sb.launchLiveUrl
    // let launchUrl = inparam.gameId == config.sb.gameType ? config.sb.launchUrl : config.sb.launchLiveUrl
    // 默认移动版
    let lobbyType = '1'
    // 自定义电脑版
    if (ctx.request.query.lobbyType || ctx.request.query.lobbyType == '0') {
        lobbyType = ctx.request.query.lobbyType
    }
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
    //获取品牌访问令牌
    let authRes = {}
    const authPost = {
        "client_id": config.sb.client_id,
        "client_secret": config.sb.client_secret,
        "grant_type": "client_credentials",
        "scope": "playerapi"
    }
    try {
        log.info(`请求SB令牌链接：${config.sb.apiServer}/api/oauth/token`)
        log.info(`请求SB令牌参数：${querystring.stringify(authPost)}`)
        authRes = await axios.post(`${config.sb.apiServer}/api/oauth/token`, querystring.stringify(authPost), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
        log.info(`请求SB令牌返回：${JSON.stringify(authRes.data)}`)
    } catch (err) {
        log.error('访问令牌出错')
        log.error(err)
    }
    //获取玩家令牌
    let playerTokenRes = await axios.post(`${config.sb.apiServer}/api/player/authorize`, {
        "ipaddress": ctx.request.ip,
        "username": inparam.userId,
        "userid": inparam.userId,
        "lang": "zh-CN",
        "cur": "RMB",
        "betlimitid": 3,//玩家级别 3黄金
        "istestplayer": false, //测试玩家为true  正式玩家为false
        "platformtype": lobbyType
    }, { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${authRes.data.access_token}` } })
    log.info(`SB玩家令牌：${playerTokenRes.data.authtoken}`)

    let finalUrl = `${launchUrl}?gpcode=${gpcode}&gcode=${inparam.gameName}&platform=${lobbyType}`
    // 非电脑版增加返回按钮链接
    if (lobbyType != '0') {
        finalUrl += `&homeurl=http%3a%2f%2fext.na77.org%2fsb%2flogout%2f${inparam.userId}%2f${inparam.sid}&token=${playerTokenRes.data.authtoken}`
    } else {
        finalUrl += `&token=${playerTokenRes.data.authtoken}`
    }
    log.info(`SB最终游戏链接：${finalUrl}`)
    ctx.redirect(finalUrl)
})

/**
 * 提供NA的token给SB
 */
router.post('/sb/wallet/token', async function (ctx, next) {
    let inparam = ctx.request.body
    let res = {
        access_token: jwt.sign({
            client_id: inparam.client_id,
            client_secret: inparam.client_secret,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) * 1,
            iat: Math.floor(Date.now() / 1000)
        }, config.auth.secret),
        token_type: "Bearer",
        expires_in: (60 * 60 * 24) * 1,
        scope: "wallet"
    }
    ctx.body = res
})

/**
 * SB查询余额
 */
router.post('/sb/wallet/balance', async function (ctx, next) {
    let inparam = ctx.request.body
    // let token = ctx.tokenVerify
    // log.info(`TOKEN解析：${JSON.stringify(token)}`)
    let promiseArr = []
    for (let user of inparam.users) {
        let p = new Promise(async (resolve, reject) => {
            let player = await new PlayerModel().getPlayerById(user.userid)
            if (player && player.userId) {
                resolve({
                    userid: user.userid,
                    wallets: [{
                        code: "NAWallet",
                        bal: player.balance,
                        cur: "RMB",
                        name: "NA wallet",
                        desc: "NA钱包"
                    }]
                })
            }
        })
        promiseArr.push(p)
    }
    let finalArr = await Promise.all(promiseArr)
    ctx.body = { users: finalArr }
})

/**
 * SB下注
 */
router.post('/sb/wallet/debit', async function (ctx, next) {
    let inparam = ctx.request.body
    // let token = ctx.tokenVerify
    // log.info(`TOKEN解析：${JSON.stringify(token)}`)
    let finalArr = []
    for (let transaction of inparam.transactions) {
        // 查询玩家
        const player = await new PlayerModel().getPlayerById(transaction.userid)
        if (!player || _.isEmpty(player)) {
            finalArr.push({
                userid: transaction.userid,
                err: 300,
                errdesc: `玩家${transaction.userid}不存在`
            })
            log.error(`玩家【${transaction.userid}】不存在`)
            continue
        }
        // 计算玩家实时余额和更新
        if (transaction.gametype == 2) {
            inparam.gameType = config.sb.videoGameType
        } else {
            inparam.gameType = config.sb.gameType
        }
        inparam.billType = 3
        inparam.amt = parseFloat(transaction.amt) * -1
        inparam.businessKey = `BSB_${transaction.userid}_${transaction.roundid}`    // 设置局号
        inparam.txnid = `SB_${transaction.userid}_BET_${transaction.ptxid}`         // 设置第三方系统唯一流水号
        inparam.txnidTemp = `BET_${transaction.userid}_${transaction.ptxid}`        // 缓存第三方交易号
        const amtAfter = await new PlayerModel().updatebalance(player, inparam)
        if (amtAfter == 'err') {
            finalArr.push({
                userid: transaction.userid,
                err: 100,
                errdesc: `玩家${transaction.userid}的余额不足`
            })
        } else if (amtAfter == player.balance && inparam.amt != 0) {
            finalArr.push({
                txid: inparam.txnid,
                ptxid: transaction.ptxid,
                dup: true
            })
        } else {
            finalArr.push({
                txid: inparam.txnid,
                ptxid: transaction.ptxid,
                bal: amtAfter,
                cur: "RMB",
                dup: false
            })
        }
    }
    log.info(`返回SB数据：${JSON.stringify({ transaction: finalArr })}`)
    ctx.body = { transactions: finalArr }
})

/**
 * SB返奖
 */
router.post('/sb/wallet/credit', async function (ctx, next) {
    let inparam = ctx.request.body
    let finalArr = []
    for (let transaction of inparam.transactions) {
        // 查询玩家
        const player = await new PlayerModel().getPlayerById(transaction.userid)
        if (!player || _.isEmpty(player)) {
            finalArr.push({
                userid: transaction.userid,
                err: 300,
                errdesc: `玩家${transaction.userid}不存在`
            })
            log.error(`玩家【${transaction.userid}】不存在`)
            continue
        }
        // 计算玩家实时余额和更新
        if (transaction.gametype == 2) {
            inparam.gameType = config.sb.videoGameType
        } else {
            inparam.gameType = config.sb.gameType
        }
        inparam.billType = 4
        inparam.amt = parseFloat(transaction.amt)
        inparam.businessKey = `BSB_${transaction.userid}_${transaction.roundid}`       // 设置局号
        inparam.txnid = `SB_${transaction.userid}_RET_${transaction.ptxid}`            // 设置第三方系统唯一流水号
        inparam.txnidTemp = `RET_${transaction.userid}_${transaction.ptxid}`           // 缓存第三方交易号
        const amtAfter = await new PlayerModel().updatebalance(player, inparam)
        if (amtAfter == player.balance && inparam.amt != 0) {
            finalArr.push({
                txid: inparam.txnid,
                ptxid: transaction.ptxid,
                dup: true
            })
        } else {
            finalArr.push({
                txid: inparam.txnid,
                ptxid: transaction.ptxid,
                bal: amtAfter,
                cur: "RMB",
                dup: false
            })
        }
    }
    log.info(`返回SB数据：${JSON.stringify({ transaction: finalArr })}`)
    ctx.body = { transactions: finalArr }
})

/**
 * SB下注取消
 */
router.post('/sb/wallet/cancel', async function (ctx, next) {
    let inparam = ctx.request.body
    let finalArr = []
    for (let transaction of inparam.transactions) {
        // 查询玩家
        const player = await new PlayerModel().getPlayerById(transaction.userid)
        if (!player || _.isEmpty(player)) {
            finalArr.push({
                userid: transaction.userid,
                err: 300,
                errdesc: `玩家${transaction.userid}不存在`
            })
            log.error(`玩家【${transaction.userid}】不存在`)
            continue
        }
        // 计算玩家实时余额和更新
        transaction.gameType = config.sb.gameType
        if (transaction.gametype == 2) {
            inparam.gameType = config.sb.videoGameType
        } else {
            inparam.gameType = config.sb.gameType
        }
        // 获取需要取消的下注
        let cancelBill = await new PlayerBillDetailModel().getBill(`ASB_BET_${transaction.userid}_${transaction.refptxid}`)
        if (cancelBill) {
            let item = {}
            let player = { userId: cancelBill.userId, userName: cancelBill.userName, parent: cancelBill.parent }
            // 计算玩家实时余额和更新
            item.gameType = inparam.gameType                                 // TODO:从配置文件获取游戏类型，未来考虑自动获取
            item.amt = Math.abs(cancelBill.amount)                           // 金额转换
            item.businessKey = cancelBill.businessKey                        // 设置局号
            item.txnid = cancelBill.txnid                                    // 设置第三方系统唯一流水号
            item.billType = 5                                                // 设置为返还
            item.txnidTemp = `REFUND_${transaction.userid}_${transaction.refptxid}`                // 缓存第三方交易号
            let amtAfter = await new PlayerModel().updatebalance(player, item)
            if (amtAfter == player.balance && item.amt != 0) {
                finalArr.push({
                    err: 610,
                    errdesc: `${transaction.refptxid}已取消`,
                    txid: item.txnid,
                    ptxid: transaction.refptxid,
                    dup: true
                })
            } else {
                finalArr.push({
                    txid: item.txnid,
                    ptxid: transaction.refptxid,
                    bal: amtAfter,
                    cur: "RMB",
                    dup: false
                })
            }
        } else {
            finalArr.push({
                txid: `SB_REFUND_${transaction.userid}_${transaction.refptxid}`,
                ptxid: transaction.refptxid,
                err: 600,
                errdesc: `交易${transaction.refptxid}不存在`
            })
            log.error(`流水ASB_${transaction.userid}_${transaction.refptxid}不存在`)
        }
    }
    log.info(`返回SB数据：${JSON.stringify({ transaction: finalArr })}`)
    ctx.body = { transactions: finalArr }
})

/**
 * 网页玩家登出
 * @param {*} userId 玩家ID
 * @param {*} sid 具体游戏ID
 */
router.get('/sb/logout/:userId/:sid', async function (ctx, next) {
    // log.info(`准备退出玩家【${ctx.params.userId}】`)
    // 请求N1退出
    let data = {
        exit: 1,
        userId: ctx.params.userId,
        gameType: config.sb.gameType,
        gameId: ctx.params.sid,
        timestamp: Date.now()
    }
    // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.sb.gameKey}`).toString(CryptoJS.enc.Hex)
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

/**
 * 进入游戏大厅
 * lobbyType 大厅类型，有四种
 */
// router.get('/sb/gameurl/:gameId/:sid/:userId/:token', async function (ctx, next) {
//     let inparam = ctx.params
//     let lobbyType = ''
//     // 真人大厅
//     if (inparam.gameId == config.sb.videoGameType) {
//         lobbyType = 'mlobbySB'
//     }
//     // 电子游戏大厅 
//     else if (inparam.gameId == config.sb.gameType) {
//         lobbyType = 'mlobbyRT'
//     } else {
//         ctx.body = { code: -1, msg: '游戏类型错误' }
//         return
//     }
//     // 自定义电脑版大厅
//     if (ctx.request.query.lobbyType) {
//         lobbyType = ctx.request.query.lobbyType
//     }
//     // 请求N1服务器是否允许玩家进入游戏
//     const nares = await axios.post(config.na.joingameurl, {
//         userId: inparam.userId,
//         gameId: inparam.gameId,
//         sid: inparam.sid
//     }, { headers: { 'Authorization': inparam.token } })
//     if (nares.data.code != 0) {
//         log.error(nares.data)
//         ctx.body = { code: nares.data.code, msg: nares.data.msg }
//         return
//     }
//     //获取品牌访问令牌
//     let authRes = {}
//     const authPost = {
//         "client_id": config.sb.client_id,
//         "client_secret": config.sb.client_secret,
//         "grant_type": "client_credentials",
//         "scope": "playerapi"
//     }
//     try {
//         log.info(`请求访问令牌参数：${querystring.stringify(authPost)}`)
//         authRes = await axios.post(`${config.sb.apiServer}/api/oauth/token`, querystring.stringify(authPost), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
//         log.info(`SB返回的访问令牌：${JSON.stringify(authRes.data)}`)
//     } catch (err) {
//         log.error('访问令牌出错')
//         log.error(err)
//     }
//     //获取玩家令牌
//     let playerTokenRes = await axios.post(`${config.sb.apiServer}/api/player/authorize`, {
//         "ipaddress": ctx.request.ip,
//         "username": inparam.userId,
//         "userid": inparam.userId,
//         "lang": "zh-CN",
//         "cur": "RMB",
//         "betlimitid": 3,//玩家级别 3黄金
//         "istestplayer": false //测试玩家为true  正式玩家为false
//     }, { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${authRes.data.access_token}` } })
//     log.info(`SB玩家令牌：${JSON.stringify(playerTokenRes.data.authtoken)}`)
// //获取游戏列表
// let gameLists = await axios.get(`${config.sb.apiServer}/api/games?lang=zh-CN&platformtype=0&authtoken=${playerTokenRes.data.authtoken}`, {
//     headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${authRes.data.access_token}` }
// })
// //打印游戏链接列表
// for (let item of gameLists.data.games) {
//     if (item.betlimits && item.betlimits[0]) {
//         item.startUrl = `${config.sb.apiServer}/gamelauncher?gpcode=${item.providercode}&gcode=${item.code}&platform=1&betlimitid=${item.betlimits[0].id}&token=:token`
//     } else {
//         item.startUrl = `${config.sb.apiServer}/gamelauncher?gpcode=${item.providercode}&gcode=${item.code}&platform=1&token=:token`
//     }
//     log.info(`SB游戏链接：${item.startUrl}`)
// }
//     //返回大厅
//     let finalUrl = `${config.sb[lobbyType]}?token=${playerTokenRes.data.authtoken}`
//     log.info(`SB最终游戏链接：${finalUrl}`)
//     ctx.redirect(finalUrl)
// })

module.exports = router