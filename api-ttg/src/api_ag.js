// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const parseString = require('xml2js').parseString
const CryptoJS = require('crypto-js')
const moment = require('moment')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const acMap = {}  // 试玩帐号缓存
const PlayerModel = require('./model/PlayerModel')
const SYSTransferModel = require('./model/SYSTransferModel')
const ipMap = {}

// 免转接出-AG游戏连接
router.get('/ag/:gameId/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    const inparam = ctx.params
    const gameType = +`${inparam.gameId.substring(0, inparam.gameId.length - 2)}00`
    const agGameType = +inparam.gameId - gameType
    inparam.method = 'auth'
    // 请求N2服务器是否允许玩家进入游戏
    const n2res = await axios.post(config.n2.apiUrl, inparam)
    if (n2res.data.code != 0) { return ctx.body = { code: n2res.data.code, msg: n2res.data.msg } }
    const player = {
        userId: inparam.userId,
        regMap: n2res.data.regMap,
        balance: n2res.data.balance
    }
    // 检查AG玩家注册
    if (!player.regMap || !player.regMap.ag) {
        const agLoginParams = `cagent=${config.ag.cagent}/\\\\/loginname=T${player.userId}/\\\\/method=lg/\\\\/actype=1/\\\\/password=123456/\\\\/cur=CNY`
        const params1 = agEnctypt(agLoginParams, config.ag.DES_Encrypt_key)
        const key1 = CryptoJS.MD5(params1 + config.ag.MD5_Encrypt_key).toString()
        const res1 = await axios.get(`${config.ag.checkOrCreateGameAccoutUrl}params=${params1}&key=${key1}`)
        const finalRes1 = await xmlParse(res1.data)
        if (finalRes1.result.$.info != 0) {
            return ctx.body = finalRes1
        }
        // 通知N2该玩家已经注册AG
        player.regMap ? player.regMap.ag = 1 : player.regMap = { ag: 1 }
        player.method = 'update'
        axios.post(config.n2.apiUrl, player)
    }
    // 建立AG Session
    const agSessionUrl = `${config.ag.createAGSessionUrl}productid=${config.ag.productid}&username=T${player.userId}&session_token=T${player.userId}&credit=${player.balance}`
    await axios.get(agSessionUrl)

    // 返回最终游戏连接
    const agGameParams = `cagent=${config.ag.cagent}/\\\\/loginname=T${player.userId}/\\\\/actype=1/\\\\/password=123456/\\\\/sid=${config.ag.cagent}${parseInt(Date.now() / 1000)}T${player.userId}/\\\\/gameType=${agGameType}/\\\\/mh5=y/\\\\/cur=CNY`
    const params2 = agEnctypt(agGameParams, config.ag.DES_Encrypt_key)
    const key2 = CryptoJS.MD5(params2 + config.ag.MD5_Encrypt_key).toString()
    const finalUrl = `${config.ag.forwardGameUrl}params=${params2}&key=${key2}`
    // log.info(`最终AG【游戏链接】${finalUrl}`)
    ctx.redirect(finalUrl)
})
// 免转接出-AG数据传输
router.post('/ag/postTransfer', async (ctx, next) => {
    // 获取入参
    let inparam = ctx.request.body.Data.Record
    // 查询玩家
    const userId = inparam.sessionToken.toString().substr(1)
    if (userId.length == 8) {
        const transactionType = inparam.transactionType
        const transactionID = inparam.transactionID
        // const gameCode = inparam.gameCode
        // 预置请求数据
        const data = {
            userId: +userId,
            method: '',
            amount: 0,
            betsn: null,
            businessKey: `BAG_${userId}_${transactionID}`,
            sn: `AG_${userId}_${transactionType}_${transactionID}`,
            timestamp: Date.now(),
            sourceIP: ipMap[userId],
            gameType: +config.ag.gameType,
            gameId: +config.ag.gameType,
            detail: inparam
        }
        // 预置SYSTransfer数据
        let item = {
            ...data,
            plat: 'YIBO',
            userNick: data.userId,
            gameType: data.gameType,
            anotherGameData: JSON.stringify(inparam),
            createdAt: data.timestamp,
            createdDate: moment(data.timestamp).utcOffset(8).format('YYYY-MM-DD'),
            createdStr: moment(data.timestamp).utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
            userId: item.userId.toString()
        }
        // 判断交易类型
        switch (transactionType) {
            case 'BET':
                item.type = 3
                data.method = 'bet'
                data.amount = parseFloat(inparam.value) * -1
                break;
            case 'WIN':
                item.type = 4
                data.method = 'win'
                data.amount = parseFloat(inparam.validBetAmount) + parseFloat(inparam.netAmount)
                data.betsn = `AG_${userId}_BET_${transactionID}`
                break;
            case 'LOSE':
                item.type = 4
                data.method = 'win'
                data.amount = parseFloat(inparam.validBetAmount) + parseFloat(inparam.netAmount)
                data.betsn = `AG_${userId}_BET_${transactionID}`
                break;
            case 'REFUND':
                item.type = 5
                data.method = 'refund'
                data.amount = parseFloat(inparam.value)
                data.betsn = `AG_${userId}_BET_${transactionID}`
                break;
            default:
                return
        }
        // 向N2同步
        try {
            let n2res = await axios.post(config.n2.apiUrl, data)
            if (n2res.data.code == 0) {
                item.status = 'Y'
                item.balance = n2res.data.balance ? +n2res.data.balance : 0
                new SYSTransferModel().putItem(item)
                ctx.body = `<TransferResponse><ResponseCode>OK</ResponseCode><Balance>${n2res.data.balance}</Balance></TransferResponse>`
            } else {
                if (n2res.data.code == -1) {
                    item.status = 'N'
                    item.errorMsg = n2res.data.msg
                    item.transferURL = config.n2.apiUrl
                    item.repush = data
                    new SYSTransferModel().putItem(item)
                } else {
                    ctx.status = 409
                    ctx.body = '<TransferResponse><ResponseCode>INSUFFICIENT_FUNDS</ResponseCode></TransferResponse>'
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
 * 获取AG游戏连接
 * @param {*} gameId NA游戏大类
 * @param {*} sid NA游戏ID
 * @param {*} userId NA玩家ID，0是试玩
 * @param {*} token NA玩家TOKEN，0是试玩
 * @param {*} lobbyType 0是电脑版，1是移动版
 */
router.get('/ag/gameurl/:gameId/:sid/:userId/:token', async (ctx, next) => {
    ipMap[ctx.params.userId] = ctx.request.ip
    const inparam = ctx.params
    // 移动版或电脑版
    const mh5 = ctx.request.query.lobbyType != '0' ? 'y' : 'n'
    const aggametype = ctx.request.query.lobbyType != '0' ? parseInt(inparam.sid) - parseInt(inparam.gameId) : 0
    // 是否试玩，默认正式玩家
    let actype = 1
    let player = { userId: 'acfun_000000', userName: 'acfun_000000', balance: 2000 }
    // 正式帐号
    if (inparam.userId != 0) {
        // 请求N1服务器是否允许玩家进入游戏
        const nares = await axios.post(config.na.joingameurl, {
            userId: inparam.userId,
            gameId: inparam.gameId,
            sid: inparam.sid,
            token: inparam.token
        })
        if (nares.data.code != 0) {
            return ctx.body = { code: nares.data.code, msg: nares.data.msg }
        }
        player = await new PlayerModel().getPlayerById(inparam.userId)
    }
    // 试玩帐号 
    else {
        actype = 0
        const num = randomNum(100000, 999999)
        player = { userId: `acfun_${num}`, userName: `acfun_${num}`, balance: 2000 } // 默认试玩帐号
        acMap[player.userId] = player.balance
    }
    // 检查AG玩家注册，试玩必检查
    if (actype == 0 || !player.regMap || !player.regMap.ag) {
        const agLoginParams = `cagent=${config.ag.cagent}/\\\\/loginname=${player.userId}/\\\\/method=lg/\\\\/actype=${actype}/\\\\/password=123456/\\\\/cur=CNY`
        // log.info(`请求AG注册【参数】${agLoginParams}`)
        const params1 = agEnctypt(agLoginParams, config.ag.DES_Encrypt_key)
        const key1 = CryptoJS.MD5(params1 + config.ag.MD5_Encrypt_key).toString()
        // log.info(`请求AG注册【GET】${config.ag.checkOrCreateGameAccoutUrl}params=${params1}&key=${key1}`)
        const res1 = await axios.get(`${config.ag.checkOrCreateGameAccoutUrl}params=${params1}&key=${key1}`)
        // log.info(`接收AG注册【返回】${res1.data}`)
        const finalRes1 = await xmlParse(res1.data)
        // log.info(`AG数据注册【转换】${JSON.stringify(finalRes1)}`)
        if (finalRes1.result.$.info != 0) {
            return ctx.body = finalRes1
        }
        // 正式玩家，更新玩家RegMap，避免下次重复注册
        if (actype) {
            player.regMap ? player.regMap.ag = 1 : player.regMap = { ag: 1 }
            new PlayerModel().updateRegMap(player)
        }
    }
    // 建立AG Session
    const dm = ctx.request.query.lobbyType != '0' ? `/dm=aguniwebview.${player.userId}.${inparam.sid}/\\\\` : ''
    const agSessionUrl = `${config.ag.createAGSessionUrl}productid=${config.ag.productid}&username=${player.userId}&session_token=${player.userName}&credit=${player.balance.toFixed(2)}`
    // log.info(`请求AG【GET】${agSessionUrl}`)
    const res2 = await axios.get(agSessionUrl)
    // log.info(`接收AG【返回】${res2.data}`)
    // const finalRes2 = await xmlParse(res2.data)
    // log.info(`AG数据【转换】${JSON.stringify(finalRes2)}`)

    // 返回最终游戏连接
    const agGameParams = `cagent=${config.ag.cagent}/\\\\/loginname=${player.userId}/\\\\/actype=${actype}/\\\\/password=123456/\\\\${dm}/sid=${config.ag.cagent}${parseInt(Date.now() / 1000)}${player.userId}/\\\\/gameType=${aggametype}/\\\\/mh5=${mh5}/\\\\/cur=CNY`
    // log.info(`请求AG【获取游戏链接】${agGameParams}`)
    const params2 = agEnctypt(agGameParams, config.ag.DES_Encrypt_key)
    const key2 = CryptoJS.MD5(params2 + config.ag.MD5_Encrypt_key).toString()
    const finalUrl = `${config.ag.forwardGameUrl}params=${params2}&key=${key2}`
    // log.info(`最终AG【游戏链接】${finalUrl}`)
    ctx.redirect(finalUrl)
})

/**
 * AG唯一接口
 * @param {*} token 玩家TOKEN
 */
router.post('/ag/postTransfer', async (ctx, next) => {
    // 获取入参
    let inparam = ctx.request.body.Data.Record
    // 查询玩家
    const username = inparam.sessionToken
    const transactionType = inparam.transactionType
    const transactionID = inparam.transactionID
    const gameCode = inparam.gameCode
    let isTest = username.indexOf('acfun_') == 0 ? true : false
    // 判断交易类型
    switch (transactionType) {
        case 'BET':
            inparam.billType = 3
            inparam.amt = parseFloat(inparam.value) * -1
            break;
        case 'WIN':
            inparam.billType = 4
            inparam.amt = parseFloat(inparam.validBetAmount) + parseFloat(inparam.netAmount)
            break;
        case 'LOSE':
            inparam.billType = 4
            inparam.amt = parseFloat(inparam.validBetAmount) + parseFloat(inparam.netAmount)
            break;
        case 'REFUND':
            inparam.billType = 5
            inparam.amt = parseFloat(inparam.value)
            break;
        default:
            return
    }
    // 设置关键数据，保存流水更新余额
    inparam.gameType = config.ag.gameType                                           // TODO:从配置文件获取游戏类型，未来考虑自动获取
    inparam.businessKey = `BAG_${username}_${gameCode}`                             // 设置局号
    inparam.anotherGameData = JSON.stringify(inparam)                               // 原始游戏信息
    inparam.txnidTemp = `${username}_${transactionType}_${transactionID}`           // 使用第三方ID作为唯一建成分
    // inparam.txnid = `AG_${inparam.username}_${transactionID}`                    // 设置第三方系统唯一流水号
    let amtAfter = 0
    // 试玩玩家，模拟扣款
    if (isTest) {
        amtAfter = acMap[username] + inparam.amt
        acMap[username] = amtAfter
    }
    // 正式玩家，真实扣款 
    else {
        const player = await new PlayerModel().getPlayer(username)
        inparam.sourceIP = ipMap[player.userId]                                    // 记录IP
        amtAfter = await new PlayerModel().updatebalance(player, inparam)
    }
    let resBody = ''
    if (amtAfter == 'err') {
        ctx.status = 409
        resBody = '<TransferResponse><ResponseCode>INSUFFICIENT_FUNDS</ResponseCode></TransferResponse>'
        ctx.body = resBody
    } else {
        // 返回实时余额
        resBody = `<TransferResponse><ResponseCode>OK</ResponseCode><Balance>${amtAfter}</Balance></TransferResponse>`
        ctx.body = resBody
    }
    // log.info(`返回AG【结果】${resBody}`)
})

/**
 * AG下注详情
 */
// router.post('/ag/betResponse', async  (ctx, next)=> {
// })

/**
 * AG查询交易状态
 */
router.get('/ag/checkTicketStatusUrl/:transactionID', async (ctx, next) => {
    let res = await axios.get(`${config.ag.checkTicketStatusUrl}?transactionID=${ctx.params.transactionID}`)
    ctx.body = res.data
})

// /**
//  * 玩家登出
//  * @param {*} userId 玩家ID
//  * @param {*} sid    具体游戏ID
//  */
// router.get('/ag/logout/:userId/:sid', async  (ctx, next) =>{
//     // log.info(`准备退出玩家【${userId}】`)
//     // 请求N1退出
//     let data = {
//         exit: 1,
//         userId: ctx.params.userId,
//         gameType: config.ag.gameType,
//         gameId: ctx.params.sid,
//         timestamp: Date.now()
//     }
//     // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.ag.gameKey}`).toString(CryptoJS.enc.Hex)
//     axios.post(config.na.exiturl, data).then(res => {
//         res.data.code != 0 ? log.error(res.data) : null
//     }).catch(err => {
//         log.error(err)
//     })
//     ctx.redirect('http://uniwebview.na77.com?key=value&anotherKey=anotherValue')
//     // ctx.body = `<script>(function(){window.location.href="uniwebview://www.na77.com?key=value&anotherKey=anotherValue"})()</script>`
// })

// 私有方法：XML解析
function xmlParse(xml) {
    return new Promise((reslove, reject) => {
        parseString(xml, function (err, res) {
            reslove(res)
        })
    })
}

// AG加密
function agEnctypt(data, secretkey) {
    const key = CryptoJS.enc.Utf8.parse(secretkey)
    const iv = CryptoJS.enc.Utf8.parse(secretkey)
    var encrypted = CryptoJS.DES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    })
    return encrypted.toString()
}
// AG解密
function agDecrypt(encrypted, secretkey) {
    const key = CryptoJS.enc.Utf8.parse(secretkey)
    const iv = CryptoJS.enc.Utf8.parse(secretkey)
    var decrypted = CryptoJS.DES.decrypt(encrypted, key, {
        iv: iv,
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    })
    return CryptoJS.enc.Utf8.stringify(decrypted)// 转换为 utf8 字符串
}

// 指定位数随机数
function randomNum(min, max) {
    let range = max - min
    let rand = Math.random()
    let num = min + Math.round(rand * range)
    return num
}

module.exports = router