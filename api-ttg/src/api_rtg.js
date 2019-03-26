// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const CryptoJS = require('crypto-js')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
// const NASign = require('./lib/NASign')

/**
 * 获取RTG游戏连接
 * @param {*} gameId 游戏大类
 * @param {*} sid 游戏小类
 * @param {*} userId 玩家ID，试玩传0
 * @param {*} token 玩家TOKEN
 */
router.get('/rtg/gameurl/:gameId/:sid/:userId/:token', async function (ctx, next) {
    let inparam = ctx.params
    let machId = ((+inparam.sid) - (inparam.gameId)).toString()
    ctx.request.query.homeurl = ctx.request.query.homeurl || 'www.na77.com'
    // 试玩
    if (inparam.userId == 0) {
        ctx.redirect(`${config.rtg.launchUrl}?cdkModule=gameLauncher&skinid=2&user=&forReal=False&token=&gameId=18&machId=${machId}&width=auto&height=auto&returnurl=http://${config.na.apidomain}/rtg/logout/0/0`)
        return
    }
    // 请求N1服务器是否允许玩家进入游戏
    const nares = await axios.post(config.na.joingameurl, {
        userId: inparam.userId,
        gameId: inparam.gameId,
        sid: inparam.sid
    }, { headers: { 'Authorization': inparam.token } })
    if (nares.data.code != 0) {
        ctx.body = { code: nares.data.code, msg: nares.data.msg }
        return
    }
    //获取玩家信息
    const player = await new PlayerModel().getPlayerById(inparam.userId)
    let pid = inparam.userId
    //如果玩家不存在,向RTG注册玩家,并更新regMap
    if (!player.regMap || !player.regMap.rtg) {
        const regData = {
            "token_type": "external_token",
            "currency_id": "CNY",
            "login": pid.toString(),
            "first_name": "false",
            "last_name": "false",
            "password": "false123",
            "email": `${pid}@false.com`,
            "day_phone": "123456",
            "evening_phone": "123456",
            "address_1": "false",
            "address_2": "false",
            "city": "false",
            "state": "false",
            "zip": "false",
            "country": "CH",
            "cell_phone": "123456",
            "sms_message": 0,
            "gender": true,
            "ip_address": "127.0.0.1",
            "mac_address": "false",
            "user_id": 0,
            "download_id": 0,
            "birth_date": "1918-07-06T06:43:11.068Z",
            "called_from_casino": 0,
            "skin_id": 2,
            "no_spam": 1
        }
        try {
            log.info(`向RTG注册玩家数据:${JSON.stringify(regData)}`)
            let rtgRes = await axios.post(`${config.rtg.baseUrl}/players/external`, regData, { headers: { 'Api_key': config.rtg.apikey, 'Content-Type': 'application/json' } })
            log.info(`RTG注册返回：${JSON.stringify(rtgRes.data)}`)
            pid = rtgRes.data.pid.toString().trim()
        } catch (error) {
            log.error(error)
            ctx.body = { code: 0, msg: '向RTG注册用户失败' }
            return
        }
        if (!player.regMap) {
            player.regMap = { rtg: pid }
        } else {
            player.regMap.rtg = pid
        }
        new PlayerModel().updateRegMap(player)
    }
    //如果玩家存在，直接获取RTG的pid
    else {
        pid = player.regMap.rtg
    }
    //先登出RTG游戏，解决余额不更新问题
    await axios.post(`${config.rtg.baseUrl}/accounts/logout?api_key=${config.rtg.apikey}`, {
        logout_type: "player_logout",
        login: player.userId.toString(),
        player_id: pid.toString(),
        for_money: true
    })
    // 获取RTG的令牌
    let rtgToken = await axios.post(`${config.rtg.baseUrl}/players/${pid}/token`, { "token_type": "external_token" }, { headers: { 'Api_key': config.rtg.apikey, 'Content-Type': 'application/json' } })
    let [skinId, login, forReal, token, gameId, width, height, returnurl] = ['2', pid, 'True', rtgToken.data, '18', 'auto', 'auto', `http://${config.na.apidomain}/rtg/logout/${inparam.userId}/${inparam.sid}%3Fhomeurl%3D${Buffer.from(ctx.request.query.homeurl).toString('base64')}`]
    //获取rtg游戏连接
    let finalUrl = `${config.rtg.launchUrl}?cdkModule=gameLauncher&skinid=${skinId}&user=${login}&forReal=${forReal}&token=${token}&gameId=${gameId}&machId=${machId}&width=${width}&height=${height}&returnurl=${returnurl}`
    log.info(`最终RTG游戏链接：${finalUrl}`)
    ctx.redirect(finalUrl)
})

/**
 * RTG获取玩家余额接口
 * @param {*} memberCode 
 */
router.get('/rtg/account/getbalance/membercode/:memberCode', async function (ctx, next) {
    //查询玩家
    const player = await new PlayerModel().getPlayerById(ctx.params.memberCode)
    if (!player || _.isEmpty(player)) {
        ctx.body = { code: 53, message: 'Player does not exist' }
        return
    }
    //返回结果
    ctx.body = { code: 0, message: "success", balance: player.balance, currency: "CNY" }
})

/**
 * RTG下注接口
 * @param {*} amount 下注金额
 * @param {*} currency 金额类型
 * @param {*} gameid 游戏id
 * @param {*} membercode  玩家名
 * @param {*} roundid 局id
 * @param {*} transactionid 第三方游戏流水号
 */
router.post('/rtg/account/placeBet', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //参数检验
    if (!inparam.roundid || !inparam.membercode || inparam.amount > 0) {
        ctx.body = { code: 100, message: 'Required field cannot be empty or null' }
        return
    }
    const username = inparam.membercode.toString().trim()
    const gameCode = inparam.roundid
    //查询玩家
    const player = await new PlayerModel().getPlayerById(username)
    if (!player || _.isEmpty(player)) {
        ctx.body = { code: 53, message: 'Player does not exist' }
        return
    }
    //组装必要数据
    inparam.billType = 3
    inparam.amt = parseFloat(inparam.amount)
    inparam.gameType = config.rtg.gameType
    inparam.businessKey = `BRTG_${username}_${gameCode}`                        // 设置局号
    inparam.txnid = inparam.transactionid                                       // 第三方游戏流水号
    inparam.txnidTemp = `BET_${username}_${inparam.transactionid}`              // 缓存第三方交易号
    inparam.anotherGameData = JSON.stringify(inparam)
    //更新余额等系列操作
    let amtAfter = await new PlayerModel().updatebalance(player, inparam)
    if (amtAfter == 'err') {
        ctx.body = { code: 404, message: "Player’s balance is insufficient to withdraw " }
    } else {
        //返回结果
        ctx.body = { code: 0, message: "success", balance: amtAfter, status: "" }
    }
})

/**
 * RTG返奖接口
 * @param {*} amount 下注金额
 * @param {*} currency 金额类型
 * @param {*} gameid 游戏id
 * @param {*} membercode 玩家名
 * @param {*} roundid 局id
 * @param {*} transactionid 第三方游戏流水号
 */
router.post('/rtg/account/settlement', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //参数检验
    if (!inparam.roundid || !inparam.membercode || inparam.amount < 0) {
        ctx.body = { code: 100, message: 'Required field cannot be empty or null' }
        return
    }
    const username = inparam.membercode.toString().trim()
    const gameCode = inparam.roundid
    //查询玩家
    const player = await new PlayerModel().getPlayerById(username)
    if (!player || _.isEmpty(player)) {
        ctx.body = { code: 53, message: 'Player does not exist' }
        return
    }
    //组装必要数据
    inparam.billType = 4
    inparam.amt = parseFloat(inparam.amount)
    inparam.gameType = config.rtg.gameType
    inparam.businessKey = `BRTG_${username}_${gameCode}`                        // 设置局号
    inparam.txnid = inparam.transactionid                                       // 第三方游戏流水号
    inparam.txnidTemp = `WIN_${username}_${inparam.transactionid}`              // 缓存第三方交易号
    inparam.anotherGameData = JSON.stringify(inparam)
    //更新余额等系列操作
    let amtAfter = await new PlayerModel().updatebalance(player, inparam)
    //返回结果
    ctx.body = { code: 0, message: "success", balance: amtAfter, status: "" }
})

/**
 * 玩家登出
 * @param {*} userId 玩家ID
 * @param {*} sid    具体游戏ID
 */
router.get('/rtg/logout/:userId/:sid', async function (ctx, next) {
    // log.info(`准备退出玩家【${userId}】`)
    if(ctx.params.userId == 0){
        return ctx.redirect('http://uniwebview.na77.com?key=value&anotherKey=anotherValue')
    }
    // 请求N1退出
    let data = {
        exit: 1,
        userId: ctx.params.userId,
        gameType: config.rtg.gameType,
        gameId: ctx.params.sid,
        timestamp: Date.now()
    }
    // data.apiKey = CryptoJS.SHA1(`${data.timestamp}${config.rtg.gameKey}`).toString(CryptoJS.enc.Hex)
    axios.post(config.na.exiturl, data).then(res => {
        res.data.code != 0 ? log.error(res.data) : null
    }).catch(err => {
        log.error(err)
    })
    // ctx.body = { code: 0, msg: '玩家退出成功' }
    if (ctx.request.query.homeurl) {
        ctx.redirect(Buffer.from(ctx.request.query.homeurl, 'base64').toString())
    } else {
        ctx.redirect('http://uniwebview.na77.com?key=value&anotherKey=anotherValue')
    }
    // ctx.body = `<script>(function(){window.history.go(-2)})()</script>`
})
module.exports = router