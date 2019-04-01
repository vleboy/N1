// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
// const CryptoJS = require('crypto-js')
// const querystring = require('querystring')
const jwt = require('jsonwebtoken')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
// const NASign = require('./lib/NASign')

/**
 * HABA PC版本游戏链接
 * gameName 游戏名称
 * gameId 游戏大类
 * sid    游戏小类
 * userId 玩家ID
 * token  玩家的NA令牌
 */
router.get('/haba/gameurl/:gameName/:gameId/:sid/:userId/:token', async function (ctx, next) {
    let inparam = ctx.params
    let finalUrl = ''
    // 试玩
    if (inparam.userId == 0) {
        finalUrl = `${config.haba.launchUrl}?brandid=${config.haba.brandid}&keyname=${inparam.gameName}&mode=fun&locale=zh-CN&ifrm=1`
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
        let habaToken = jwt.sign({ userId: inparam.userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 }, config.haba.gameKey)
        finalUrl = `${config.haba.launchUrl}?brandid=${config.haba.brandid}&keyname=${inparam.gameName}&token=${habaToken}&mode=real&locale=zh-CN&ifrm=1`
    }
    log.info(`HABA最终游戏链接：${finalUrl}`)
    ctx.redirect(finalUrl)
})

// 登录认证playerdetailrequest
router.post('/haba/auth', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //解析token
    try {
        let tokenInfo = jwt.verify(inparam.playerdetailrequest.token, config.haba.gameKey)
        //验证玩家
        const player = await new PlayerModel().getPlayerById(tokenInfo.userId)
        ctx.body = { "playerdetailresponse": { "status": { "success": true, "autherror": false, "message": "" }, "accountid": player.userId, "balance": player.balance, "currencycode": "CNY" } }
    } catch (error) {
        ctx.body = { "playerdetailresponse": { "status": { "success": false, "autherror": true, "message": "token解析失败" } } }
    }
})

// 接收交易fundtransferrequest
router.post('/haba/transaction', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    let fundQuest = inparam.fundtransferrequest
    let player = {}
    //退款
    if (fundQuest.isretry == true && fundQuest.isrefund == true) {
        player = await new PlayerModel().getPlayerById(fundQuest.accountid)
        inparam.billType = 5
        inparam.gameType = config.haba.gameType
        inparam.amt = Math.abs(fundQuest.funds.refund.amount)
        inparam.businessKey = `BHABA_${player.userId}_${fundQuest.gameinstanceid}`              // 设置bk
        inparam.txnidTemp = `REFUND_${player.userId}_${fundQuest.funds.refund.transferid}`      // 设置sn
        inparam.anotherGameData = JSON.stringify(inparam)                                       // 原始游戏信息
        delete inparam.auth                                                                     // 删掉auth
        let amtAfter = await new PlayerModel().updatebalance(player, inparam)
        return ctx.body = { "fundtransferresponse": { "status": { "success": true, "refundstatus": 1 }, "balance": amtAfter, "currencycode": "CNY" } }
    }
    // 下注和返奖，必须先处理下注再处理返奖
    let fundArr = fundQuest.funds.fundinfo
    let newFundArr1 = [], newFundArr2 = []
    for (let item of fundArr) {
        if (item.gamestatemode == 1) {
            newFundArr1.push(item)//下注
        } else {
            newFundArr2.push(item)//返奖
        }
    }
    let newFundArr = _.concat(newFundArr1, newFundArr2)
    let amtAfter = 'err'
    let isError = false
    let bkArr = []
    for (let item of newFundArr) {
        player = await new PlayerModel().getPlayerById(fundQuest.accountid)
        //下注
        if (item.gamestatemode == 1) {
            inparam.billType = 3
            inparam.gameType = config.haba.gameType
            inparam.amt = Math.abs(item.amount) * -1
            inparam.businessKey = `BHABA_${player.userId}_${fundQuest.gameinstanceid}`   // 设置bk
            inparam.txnidTemp = `BET_${player.userId}_${item.transferid}`                // 设置sn
            inparam.anotherGameData = JSON.stringify(inparam)                            // 原始游戏信息
            delete inparam.auth                                                                     // 删掉auth
            amtAfter = await new PlayerModel().updatebalance(player, inparam)
            if (amtAfter == 'err') {
                isError = true
                bkArr.push(fundQuest.gameinstanceid)
            }
        }
        //返奖(0是返奖但是进入免费还会返奖，2是完成的返奖) 
        else if (_.indexOf(bkArr, fundQuest.gameinstanceid) == -1) {
            inparam.billType = 4
            inparam.gameType = config.haba.gameType
            inparam.amt = Math.abs(item.amount)
            inparam.businessKey = `BHABA_${player.userId}_${fundQuest.gameinstanceid}`   // 设置bk
            inparam.txnidTemp = `WIN_${player.userId}_${item.transferid}`                // 设置sn
            inparam.anotherGameData = JSON.stringify(inparam)                            // 原始游戏信息
            delete inparam.auth                                                          // 删掉auth
            amtAfter = await new PlayerModel().updatebalance(player, inparam)
        }
    }
    // 失败
    if (isError) {
        //下注和返奖同时到的失败
        if (fundQuest.funds.debitandcredit == true) {
            ctx.body = { "fundtransferresponse": { "status": { "success": false, "successdebit": false, "successcredit": false }, "balance": player.balance, "currencycode": "CNY" } }
        }
        //下注和返奖单独到的失败
        else {
            ctx.body = { "fundtransferresponse": { "status": { "success": false, "nofunds": true, }, "balance": player.balance, "currencycode": "CNY" } }
        }
    }
    // 成功 
    else {
        //下注和返奖同时到的成功
        if (fundQuest.funds.debitandcredit == true) {
            ctx.body = { "fundtransferresponse": { "status": { "success": true, "successdebit": true, "successcredit": true }, "balance": amtAfter, "currencycode": "CNY" } }
        }
        //下注和返奖单独到的成功
        else {
            ctx.body = { "fundtransferresponse": { "status": { "success": true, }, "balance": amtAfter, "currencycode": "CNY" } }
        }
    }
})

// 查询状态queryrequest
router.post('/haba/query', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    let sn = `BET_${inparam.queryrequest.accountid}_${inparam.queryrequest.transferid}`
    let billBet = await new PlayerBillDetailModel().getBill(sn)
    if (!billBet || _.isEmpty(billBet)) {
        ctx.body = { "fundtransferresponse": { "status": { "success": false } } }
    } else {
        ctx.body = { "fundtransferresponse": { "status": { "success": true } } }
    }
})

// 游戏配置
// router.post('/haba/config', async function (ctx, next) {

// })

/**
 * 玩家登出
 * @param {*} userId 玩家ID
 * @param {*} sid    具体游戏ID
 */
router.get('/haba/logout/:userId/:sid', async function (ctx, next) {
    // log.info(`准备退出玩家【${userId}】`)
    if (ctx.params.userId == 0) {
        return ctx.redirect(decodeURIComponent(ctx.request.query.homeurl))
    }
    // 请求N1退出
    let data = {
        exit: 1,
        userId: ctx.params.userId,
        gameType: config.haba.gameType,
        gameId: ctx.params.sid,
        timestamp: Date.now()
    }
    // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.haba.gameKey}`).toString(CryptoJS.enc.Hex)
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