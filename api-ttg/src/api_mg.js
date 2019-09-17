// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const parseString = require('xml2js').parseString
const uuid = require('uuid/v4')
// const CryptoJS = require('crypto-js')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const ipMap = {}
const gameIdMap = {}

// 免转接出-MG游戏链接
router.get('/mg/:gameId/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    gameIdMap[ctx.params.userId] = ctx.params.gameId
    const inparam = ctx.params
    // 请求N2服务器是否允许玩家进入游戏
    const nares = await axios.post(config.n2.apiUrl, { userId: inparam.userId, method: 'auth' })
    if (nares.data.code != 0) {
        return ctx.body = { code: nares.data.code, msg: nares.data.msg }
    }
    // 从MG获取游戏链接
    const lpsGameId = parseInt(inparam.gameId) - parseInt(config.mg.gameType)
    const postdata = `<?xml version="1.0"?><launch-req seq="${uuid()}" token="${inparam.userId}" passPhrase="${config.mg.gameKey}" lpsGameId="${lpsGameId}" langCode="zh" currencyCode="${config.mg.currencyCode}" demoMode="false" partnerId="asia" />`
    // log.info(`请求MG【POST】${config.mg.launchapi}`)
    // log.info(`请求MG【参数】${postdata}`)
    const res = await axios.post(config.mg.launchapi, postdata, { headers: { 'Content-Type': 'application/xml' } })
    // log.info(`接收MG【返回】${res.data}`)
    const finalRes = await xmlParse(res.data)
    // log.info(`MG数据【转换】${JSON.stringify(finalRes)}`)
    let finalUrl = finalRes['launch-resp'].$.url + '?'
    for (let param of finalRes['launch-resp'].params[0].param) {
        if (param.$.value) {
            finalUrl += `${param.$.name}=${param.$.value}&`
        }
    }
    ctx.redirect(finalUrl.substring(0, finalUrl.length - 1))
})

//免转接出-MG数据传输
router.post('/mg/one', async (ctx, next) => {
    // 获取功能
    let tag = ''
    // 获取入参
    let inparam = {}
    for (let key in ctx.request.body) {
        tag = key
        inparam = ctx.request.body[key].$
    }
    // 校验密钥是否有效
    if (inparam.passPhrase != config.mg.gameKey) {
        return
    }
    // 查询玩家
    console.log(inparam)
    const userId = inparam.token
    if (userId.length == 8) {
        // 预置请求数据
        const data = {
            userId: +userId,
            method: '',
            amount: 0,
            betsn: null,
            businessKey: `BMG_${userId}_${inparam.vendorTxNo}`,
            sn: `MG_${userId}_${inparam.txType}_${inparam.vendorTxId}`,
            timestamp: Date.now(),
            sourceIP: ipMap[userId],
            gameType: +config.mg.gameType,
            gameId: gameIdMap[userId] ? +gameIdMap[userId] : +config.mg.gameType,
            detail: inparam
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
        let n2res
        switch (tag) {
            case 'player-detail-req':
                n2res = await axios.post(config.n2.apiUrl, { userId: data.userId, method: 'balance' })
                // if (n2res.data.code == 0) {
                return ctx.body = `<player-detail-resp seq="${inparam.seq}" token="${inparam.token}" username="${data.userId}" userId="${data.userId}" firstName="${data.userId}" balance="${n2res.data.balance}" currencyCode="${config.mg.currencyCode}" status="0" statusDesc="Ok" lastName="${data.userId}" country="CN" />`
                // }
                break;
            case 'balance-req':
                n2res = await axios.post(config.n2.apiUrl, { userId: data.userId, method: 'balance' })
                // if (n2res.data.code == 0) {
                return ctx.body = `<balance-resp seq="${inparam.seq}" token="${inparam.token}" balance="${n2res.data.balance}" status="0" statusDesc="Ok" />`
                // }
                break;
            case 'transaction-req':
                // 计算玩家实时余额和更新
                inparam.amt = (parseFloat(inparam.amount) / 100.00).toFixed(2)
                if (inparam.txType == 'bet') {
                    item.type = 3
                    data.method = 'bet'
                    data.amount = Math.abs(inparam.amt) * -1
                } else if (inparam.txType == 'win') {
                    item.type = 4
                    data.method = 'win'
                    data.amount = Math.abs(inparam.amt)
                } else if (inparam.txType == 'refund') {
                    item.type = 5
                    data.method = 'refund'
                    data.amount = Math.abs(inparam.amt)
                }
                break;
            case 'end-game-req':
                n2res = await axios.post(config.n2.apiUrl, { userId: data.userId, method: 'balance' })
                return ctx.body = `<end-game-resp seq="${inparam.seq}" token="${inparam.token}" status="0" statusDesc="Ok" balance="${n2res.data.balance}" />`
                break;
            default:
                break;
        }
        // 向N2同步
        try {
            n2res = await axios.post(config.n2.apiUrl, data)
            if (n2res.data.code == 0) {
                item.status = 'Y'
                item.balance = n2res.data.balance ? +n2res.data.balance : 0
                new SYSTransferModel().putItem(item)
                return ctx.body = `<transaction-resp seq="${inparam.seq}" token="${inparam.token}" status="0" statusDesc="Ok" balance="${parseInt(n2res.data.balance * 100)}" partnerTxId="${data.sn}" />`
            } else {
                if (n2res.data.code == -1) {
                    item.status = 'N'
                    item.errorMsg = n2res.data.msg
                    item.transferURL = config.n2.apiUrl
                    item.repush = data
                    new SYSTransferModel().putItem(item)
                } else {
                    return ctx.body = `<transaction-resp seq="${inparam.seq}" token="${inparam.token}" status=”10” statusDesc="余额不足" />`
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
 * MG PC版本游戏链接
 * gameId 游戏大类
 * sid    游戏小类
 * userName 玩家帐号
 * userId 玩家ID
 * token  玩家的NA令牌
 */
router.get('/mg/gameurl/:gameId/:sid/:userName/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    const inparam = ctx.params
    // 请求N1服务器是否允许玩家进入游戏
    const nares = await axios.post(config.na.joingameurl, {
        userId: inparam.userId,
        gameId: inparam.gameId,
        sid: inparam.sid,
        token: inparam.token
    })
    // 判断玩家是否在其他游戏中
    if (nares.data.code != 0) {
        return ctx.body = { code: nares.data.code, msg: nares.data.msg }
    }
    // 从MG获取游戏链接
    let lpsGameId = parseInt(inparam.sid) - parseInt(inparam.gameId)
    const postdata = `<?xml version="1.0"?><launch-req seq="${uuid()}" token="${inparam.userName}" passPhrase="${config.mg.gameKey}" lpsGameId="${lpsGameId}" langCode="zh" currencyCode="${config.mg.currencyCode}" demoMode="false" partnerId="asia" />`//lobbyUrl="http://${config.na.apidomain}/mg/logout/${inparam.userId}/${inparam.sid}" bankingUrl="http://${config.na.apidomain}/mg/logout/${inparam.userId}/${inparam.sid}" logoutRedirectUrl="http://${config.na.apidomain}/mg/logout/${inparam.userId}/${inparam.sid}"
    // log.info(`请求MG【POST】${config.mg.launchapi}`)
    // log.info(`请求MG【参数】${postdata}`)
    const res = await axios.post(config.mg.launchapi, postdata, {
        headers: { 'Content-Type': 'application/xml' }
    })
    // log.info(`接收MG【返回】${res.data}`)
    const finalRes = await xmlParse(res.data)
    // log.info(`MG数据【转换】${JSON.stringify(finalRes)}`)
    let finalUrl = finalRes['launch-resp'].$.url + '?'
    for (let param of finalRes['launch-resp'].params[0].param) {
        if (param.$.value) {
            finalUrl += `${param.$.name}=${param.$.value}&`
        }
    }
    ctx.redirect(finalUrl.substring(0, finalUrl.length - 1))
})

/**
 * MG唯一接口
 * @param {*} token 玩家TOKEN
 */
router.post('/mg/one', async (ctx, next) => {
    // 获取功能
    let tag = ''
    // 获取入参
    let inparam = {}
    for (let key in ctx.request.body) {
        tag = key
        inparam = ctx.request.body[key].$
    }
    // 校验密钥是否有效
    if (inparam.passPhrase != config.mg.gameKey) {
        return
    }
    // 查询玩家
    const username = inparam.token
    const player = await new PlayerModel().getPlayer(username)
    if (!player || _.isEmpty(player)) {
        ctx.body = `<player-detail-resp seq="${inparam.seq}" token="${inparam.token}" status=”9” statusDesc="玩家不存在" />`
        log.error(`玩家【${username}】不存在`)
        return
    }
    const balance = parseInt((player.balance * 100).toFixed(2))
    let resBody = ''
    switch (tag) {
        case 'player-detail-req':
            resBody = `<player-detail-resp seq="${inparam.seq}" token="${inparam.token}" username="${player.userId}" userId="${player.userId}" firstName="${player.userId}" balance="${balance}" currencyCode="${config.mg.currencyCode}" status="0" statusDesc="Ok" lastName="${player.userId}" country="CN" />`
            ctx.body = resBody
            break;
        case 'balance-req':
            resBody = `<balance-resp seq="${inparam.seq}" token="${inparam.token}" balance="${balance}" status="0" statusDesc="Ok" />`
            ctx.body = resBody
            break;
        case 'transaction-req':
            // 计算玩家实时余额和更新
            inparam.gameType = config.mg.gameType    // TODO:从配置文件获取游戏类型，未来考虑自动获取
            inparam.amt = (parseFloat(inparam.amount) / 100.00).toFixed(2)
            if (inparam.txType == 'bet') {
                inparam.amt *= -1
            } else if (inparam.txType == 'refund') {
                inparam.billType = 5
            }
            // 设置关键数据，保存流水更新余额
            inparam.businessKey = `BMG_${username}_${inparam.vendorTxNo}`               // 设置局号
            inparam.txnid = `MG_${username}_${inparam.vendorTxId}`                      // 设置第三方系统唯一流水号
            inparam.txnidTemp = `${inparam.txType}_${username}_${inparam.vendorTxId}`   // 缓存第三方系统唯一流水号
            inparam.sourceIP = ipMap[player.userId]                                     // 记录IP
            let amtAfter = await new PlayerModel().updatebalance(player, inparam)
            if (amtAfter == 'err') {
                resBody = `<transaction-resp seq="${inparam.seq}" token="${inparam.token}" status=”10” statusDesc="余额不足" />`
                ctx.body = resBody
            } else {
                amtAfter = parseInt(amtAfter * 100)
                // 返回实时余额
                resBody = `<transaction-resp seq="${inparam.seq}" token="${inparam.token}" status="0" statusDesc="Ok" balance="${amtAfter}" partnerTxId="${inparam.sntemp}" />`
                ctx.body = resBody
            }
            break;
        case 'end-game-req':
            // log.info(`准备退出玩家【${username}】`)
            // 请求N1退出
            let data = {
                exit: 1,
                userId: player.userId,
                gameType: config.mg.gameType,
                gameId: player.sid,
                timestamp: Date.now()
            }
            // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.mg.gameKey}`).toString(CryptoJS.enc.Hex)
            axios.post(config.na.exiturl, data).then(res => {
                res.data.code != 0 ? log.error(res.data) : null
            }).catch(err => {
                log.error(err)
            })
            resBody = `<end-game-resp seq="${inparam.seq}" token="${inparam.token}" status="0" statusDesc="Ok" balance="${balance}" />`
            ctx.body = resBody
            break;
        default:
            break;
    }
    // log.info(`返回MG【结果】${resBody}`)
})

// 私有方法：XML解析
function xmlParse(xml) {
    return new Promise((reslove, reject) => {
        parseString(xml, function (err, res) {
            reslove(res)
        })
    })
}

// /**
//  * MG请求进入链接
//  * @param {*} token 玩家TOKEN
//  */
// router.post('/mg/gameurl', async  (ctx, next) =>{
//     const inparam = ctx.request.body['gameurlreq'].$
//     // 请求N1服务器是否允许玩家进入游戏
//     const nares = await axios.post(config.na.joingameurl, {
//         userId: inparam.userId,
//         gameId: inparam.gameId,
//         sid: inparam.sid,
//         token: inparam.token
//     })
//     // 判断玩家是否在其他游戏中
//     if (nares.data.code != 0) {
//         ctx.body = { code: nares.data.code, msg: nares.data.msg }
//     } else {
//         // 从MG获取游戏链接
//         let lpsGameId = parseInt(inparam.sid) - parseInt(inparam.gameId)
//         const postdata = `<?xml version="1.0"?><launch-req seq="${uuid()}" token="${inparam.userName}" passPhrase="${config.mg.gameKey}" lpsGameId="${lpsGameId}" langCode="zh" currencyCode="${config.mg.currencyCode}" demoMode="false" partnerId="asia" lobbyUrl="http://${config.na.apidomain}/mg/logout/${inparam.userId}/${inparam.sid}" bankingUrl="http://${config.na.apidomain}/mg/logout/${inparam.userId}/${inparam.sid}" logoutRedirectUrl="http://${config.na.apidomain}/mg/logout/${inparam.userId}/${inparam.sid}"/>`
//         // log.info(`请求MG【POST】${config.mg.launchapi}`)
//         // log.info(`请求MG【参数】${postdata}`)
//         const res = await axios.post(config.mg.launchapi, postdata, {
//             headers: { 'Content-Type': 'application/xml' }
//         })
//         // log.info(`接收MG【返回】${res.data}`)
//         const finalRes = await xmlParse(res.data)
//         // log.info(`MG数据【转换】${JSON.stringify(finalRes)}`)
//         let finalUrl = finalRes['launch-resp'].$.url + '?'
//         for (let param of finalRes['launch-resp'].params[0].param) {
//             if (param.$.value) {
//                 finalUrl += `${param.$.name}=${param.$.value}&`
//             }
//         }
//         ctx.body = { code: 0, url: finalUrl.substring(0, finalUrl.length - 1) }
//     }
// })

// /**
//  * 玩家登出
//  * @param {*} userId 玩家ID
//  * @param {*} sid    具体游戏ID
//  */
// router.get('/mg/logout/:userId/:sid', async  (ctx, next)=> {
//     // log.info(`准备退出玩家【${userId}】`)
//     // 请求N1退出
//     let data = {
//         exit: 1,
//         userId: ctx.params.userId,
//         gameType: config.mg.gameType,
//         gameId: ctx.params.sid,
//         timestamp: Date.now()
//     }
//     // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.mg.gameKey}`).toString(CryptoJS.enc.Hex)
//     axios.post(config.na.exiturl, data).then(res => {
//         res.data.code != 0 ? log.error(res.data) : null
//     }).catch(err => {
//         log.error(err)
//     })
//     if (ctx.request.query.homeurl) {
//         ctx.redirect(decodeURIComponent(ctx.request.query.homeurl))
//     } else {
//         ctx.body = { code: 0, msg: '玩家退出成功' }
//     }
// })

// /**
//  * 玩家登出
//  * @param {*} userId 玩家ID
//  * @param {*} sid    具体游戏ID
//  */
// router.post('/mg/logout/:userId/:sid', async  (ctx, next) =>{
//     // log.info(`准备退出玩家【${userId}】`)
//     // 请求N1退出
//     let data = {
//         exit: 1,
//         userId: ctx.params.userId,
//         gameType: config.mg.gameType,
//         gameId: ctx.params.sid,
//         timestamp: Date.now()
//     }
//     // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.mg.gameKey}`).toString(CryptoJS.enc.Hex)
//     axios.post(config.na.exiturl, data).then(res => {
//         res.data.code != 0 ? log.error(res.data) : null
//     }).catch(err => {
//         log.error(err)
//     })
//     ctx.redirect('http://uniwebview.na77.com?key=value&anotherKey=anotherValue')
//     // ctx.body = `<script>(function(){window.location.href="uniwebview://www.na77.com?key=value&anotherKey=anotherValue"})()</script>`
// })

// 私有方法：等待5秒钟
// function waitASecond() {
//     return new Promise((reslove, reject) => {
//         setTimeout(function () {
//             reslove('Y')
//         }, 5000);
//     })
// }

module.exports = router